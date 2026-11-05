import { decimalFraction, divideHalfUp } from '../../../shared/money/decimal.ts'
import type {
  CheckoutErrorCode,
  CheckoutInput,
  CheckoutPayment,
  CheckoutSettlement,
  EncounterDue,
  GradeDiscount,
  GradeDiscountInput,
  PaymentMethod,
  PrepaidKind,
  SettlementResult,
  SplitAmount,
} from './checkout-settlement.types.ts'

/** 서버가 만드는 결제 수단입니다. 요청의 `payments`에 넣으면 422입니다. 패키지 차감도 서버가 계산합니다. */
const SERVER_MADE_METHODS: ReadonlySet<PaymentMethod> = new Set(['JEJU_SUBSIDY', 'OVERPAID_CREDIT', 'PACKAGE'])

const ZERO: SplitAmount = { taxable: 0, taxExempt: 0 }

/** 선택한 진료의 받을 금액·급여 본인부담·제주 지원금 합입니다. */
export function sumEncounters(encounters: readonly EncounterDue[]): {
  due: SplitAmount
  insuredCopay: number
  jejuSubsidy: number
} {
  return encounters.reduce(
    (sum, encounter) => ({
      due: add(sum.due, encounter.due),
      insuredCopay: sum.insuredCopay + encounter.insuredCopay,
      jejuSubsidy: sum.jejuSubsidy + encounter.jejuSubsidy,
    }),
    { due: ZERO, insuredCopay: 0, jejuSubsidy: 0 },
  )
}

/**
 * 제주 지원금 결제 금액입니다 (결정 4).
 *
 * `min(지원금 합, 급여 본인부담 합)`입니다. 현행처럼 진료별이 아니라 선택한 진료 전체로 상한을 잡습니다.
 * 과세는 비급여뿐이라 상한에 넣지 않습니다. 지원금 합이나 급여 본인부담이 0 이하면 0입니다.
 */
export function jejuSubsidyAmount(subsidy: number, insuredCopay: number): number {
  return Math.max(0, Math.min(subsidy, insuredCopay))
}

/** 과수납 잔액에서 쓸 금액입니다. 고른 부분의 받을 금액까지만 씁니다. */
export function overpaidCreditApplied(
  due: SplitAmount,
  balance: number,
  target: CheckoutInput['useOverpaidCredit'],
): SplitAmount {
  const credit = Math.max(0, balance)
  if (target === 'TAX_EXEMPT') return { taxable: 0, taxExempt: Math.min(credit, Math.max(0, due.taxExempt)) }
  if (target === 'TAXABLE') return { taxable: Math.min(credit, Math.max(0, due.taxable)), taxExempt: 0 }
  return ZERO
}

/**
 * 수납 결산입니다. 견적(`:quote-checkout`)과 수납(`:checkout`)이 같은 계산을 씁니다.
 *
 * 1. 받을 금액에서 제주 지원금(비과세)과 과수납금(고른 부분)을 뺍니다. 둘 다 그 부분의 받을 금액까지만 씁니다.
 *    처방 수정으로 한 부분이 음수가 되면 그대로 두고 다른 부분과 합산합니다 (결정 3)
 * 2. 남은 금액 = 실효 받을 금액 − 받은 금액을 과세·비과세 합으로 봅니다 (결정 1·3)
 * 3. 음수면 `OVERPAID`, 0이면 `PAID`, 양수면 `writeOffRemainder`에 따라 `WRITTEN_OFF` 또는 `OUTSTANDING`입니다.
 *    과수납인데 손비를 요청하면 422 `WRITE_OFF_OVERPAID`이고, 0이면 손비 요청을 무시합니다 (결정 2)
 * 4. 남은 금액이 있는데 입력 결제가 없고 손비도 아니면 미수 확인(`OUTSTANDING`)이 필요합니다 (결정 8)
 */
export function settleCheckout(input: CheckoutInput): CheckoutSettlement {
  assertPayments(input.payments)
  const payments = normalizedPayments(input.payments)
  const errors = paymentErrors(payments, input.prepaidBalances)

  const { due, insuredCopay, jejuSubsidy: subsidy } = sumEncounters(input.encounters)
  const jejuSubsidy = jejuSubsidyAmount(subsidy, Math.min(insuredCopay, due.taxExempt))
  const afterJeju = { taxable: due.taxable, taxExempt: due.taxExempt - jejuSubsidy }
  const credit = overpaidCreditApplied(afterJeju, input.overpaidCreditBalance, input.useOverpaidCredit)
  const effectiveDue = subtract(afterJeju, credit)
  const entered = payments.reduce((sum, payment) => add(sum, payment.amount), ZERO)
  const received = add(add(entered, credit), { taxable: 0, taxExempt: jejuSubsidy })
  const remaining = total(due) - total(received)

  const writeOff = input.writeOffRemainder === true
  if (remaining < 0 && writeOff) errors.push('WRITE_OFF_OVERPAID')
  const result: SettlementResult =
    remaining < 0 ? 'OVERPAID' : remaining === 0 ? 'PAID' : writeOff ? 'WRITTEN_OFF' : 'OUTSTANDING'

  const needsConfirm = result === 'OUTSTANDING' && payments.length === 0
  const confirmed = input.acknowledge?.includes('OUTSTANDING') === true
  const warnings: 'OUTSTANDING'[] = needsConfirm && !confirmed ? ['OUTSTANDING'] : []
  const acknowledged: 'OUTSTANDING'[] = needsConfirm && confirmed ? ['OUTSTANDING'] : []

  return {
    jejuSubsidy,
    overpaidCreditApplied: credit,
    due,
    effectiveDue,
    entered,
    received,
    remaining,
    result,
    outstanding: result === 'OUTSTANDING' ? remaining : 0,
    overpaid: result === 'OVERPAID' ? -remaining : 0,
    writtenOff: result === 'WRITTEN_OFF' ? remaining : 0,
    errors,
    warnings,
    acknowledged,
    accepted: errors.length === 0 && warnings.length === 0,
  }
}

/** 0원 결제를 뺍니다. 현행 화면도 비어 있거나 `"0"`인 행을 보내지 않았습니다. */
export function normalizedPayments(payments: readonly CheckoutPayment[]): CheckoutPayment[] {
  return payments.filter((payment) => total(payment.amount) !== 0)
}

/**
 * 선수금을 계열별로 나누는 기본 제안입니다. 견적이 화면에 채워 줄 값이고, 수납은 받은 그대로 검사합니다 (결정 6).
 *
 * 현금 계열 잔액에서 비과세, 과세 순으로 채우고 나머지를 카드 계열로 보냅니다. 0원 결제는 만들지 않습니다.
 */
export function suggestPrepaidSplit(amount: SplitAmount, balances: Record<PrepaidKind, number>): CheckoutPayment[] {
  let cash = Math.max(0, balances.CASH_LIKE)
  const cashTaxExempt = Math.min(amount.taxExempt, cash)
  cash -= cashTaxExempt
  const cashTaxable = Math.min(amount.taxable, cash)
  const split: CheckoutPayment[] = [
    { method: 'PREPAID', prepaidKind: 'CASH_LIKE', amount: { taxable: cashTaxable, taxExempt: cashTaxExempt } },
    {
      method: 'PREPAID',
      prepaidKind: 'CARD_LIKE',
      amount: { taxable: amount.taxable - cashTaxable, taxExempt: amount.taxExempt - cashTaxExempt },
    },
  ]
  return normalizedPayments(split)
}

/**
 * 환자 등급 할인입니다 (결정 7).
 *
 * `원금액 = (단가 + 세금) × 일투여량 × 투약일수`이고, 할인후금액은 `원금액 × (100 − 할인율) / 100`을 한 번만
 * 반올림(0.5는 올림)합니다. 일투여량이 소수(예: 0.5)여도 분모를 따로 두어 정수 연산으로 계산하므로 부동소수
 * 오차가 없습니다. 원금액도 같은 방식으로 반올림합니다.
 */
export function gradeDiscount(input: GradeDiscountInput): GradeDiscount {
  if (!Number.isInteger(input.rate) || input.rate < 0 || input.rate > 100) {
    throw new RangeError(`Expected a discount rate between 0 and 100, got ${input.rate}`)
  }
  for (const value of [input.unitPrice, input.tax, input.days]) {
    if (!Number.isInteger(value) || value < 0) throw new RangeError(`Expected a non-negative integer, got ${value}`)
  }
  const { numerator: dose, denominator } = decimalFraction(input.dailyDose)
  const base = (input.unitPrice + input.tax) * dose * input.days
  const original = divideHalfUp(base, denominator)
  const discounted = divideHalfUp(base * (100 - input.rate), denominator * 100)
  return { original, discounted, discount: original - discounted }
}

/**
 * 결제 금액이 0 이상 정수인지 확인합니다. 요청 스키마가 400 `VALIDATION_FAILED`로 먼저 막으므로,
 * 여기까지 온 잘못된 금액은 호출하는 쪽의 버그라 예외로 알립니다.
 */
function assertPayments(payments: readonly CheckoutPayment[]): void {
  for (const { amount } of payments) {
    for (const value of [amount.taxable, amount.taxExempt]) {
      if (!Number.isInteger(value) || value < 0) throw new RangeError(`Expected a non-negative integer, got ${value}`)
    }
  }
}

function paymentErrors(
  payments: readonly CheckoutPayment[],
  balances: Record<PrepaidKind, number>,
): CheckoutErrorCode[] {
  const errors = new Set<CheckoutErrorCode>()
  const used: Record<PrepaidKind, number> = { CASH_LIKE: 0, CARD_LIKE: 0 }
  for (const payment of payments) {
    if (SERVER_MADE_METHODS.has(payment.method)) errors.add('PAYMENT_METHOD_NOT_ALLOWED')
    if (payment.method !== 'PREPAID') continue
    if (payment.prepaidKind === undefined) {
      errors.add('PREPAID_KIND_REQUIRED')
      continue
    }
    used[payment.prepaidKind] += total(payment.amount)
  }
  for (const kind of ['CASH_LIKE', 'CARD_LIKE'] as const) {
    if (used[kind] > Math.max(0, balances[kind])) errors.add('PREPAID_BALANCE_INSUFFICIENT')
  }
  return [...errors]
}

function add(left: SplitAmount, right: SplitAmount): SplitAmount {
  return { taxable: left.taxable + right.taxable, taxExempt: left.taxExempt + right.taxExempt }
}

function subtract(left: SplitAmount, right: SplitAmount): SplitAmount {
  return { taxable: left.taxable - right.taxable, taxExempt: left.taxExempt - right.taxExempt }
}

function total(amount: SplitAmount): number {
  return amount.taxable + amount.taxExempt
}
