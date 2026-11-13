import { Result } from 'effect'
import { domainEvent, eventContext } from '../../../shared/events/domain-event.ts'
import type { DecisionContext, DomainEvent } from '../../../shared/events/domain-event.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { ageOn } from '../../../shared/time/calendar.ts'
import type { Encounter } from '../../clinical/encounters/encounter.ts'
import { VisitTransitionInvalid } from '../visits/visit.ts'
import type { Visit } from '../visits/visit.ts'
import { normalizedPayments, settleCheckout } from './checkout-settlement.ts'
import type { CheckoutPayment, EncounterDue, OverpaidCreditTarget, PaymentMethod } from './checkout-settlement.types.ts'
import { type CopayBasis, copayBasis } from './insured-copay.ts'
import { refundableOf, toReceiptPayment, voidReceipt } from './receipt-adjustments.ts'
import { chargesOf, encounterDue, quoteIdOf } from './receipt-charges.ts'
import {
  byRecorded,
  CheckoutCoverageUnsupported,
  CheckoutEncounterInvalid,
  CheckoutPaymentInvalid,
  CheckoutRejected,
  ExternalPaymentMethod,
  PaymentRefundRequired,
  ReceiptAlreadyExists,
  ReceiptVoided,
} from './receipt.ts'
import type { Payment, Receipt, ReceiptRecord } from './receipt.ts'

/**
 * 영수증 애그리거트입니다 (docs/design/domain-model.md). 수납 취소·정정의 판정 함수와, 수납(`checkout.aggregate.ts`)·
 * 견적이 같이 쓰는 계산을 둡니다. 판정 함수는 순수 함수이고, 서비스가 읽어 둔 진료·결제와 시각을 받습니다.
 *
 * 금액은 일반 진료의 처방 금액과 건보·의료급여 진료의 급여 본인부담(`insuredCopay`)입니다. 선수금·과수납금 잔액은
 * 0으로 보고, 제주 지원금·패키지·등급 할인은 없습니다. 그 데이터가 생길 때 결산 입력에 더합니다.
 */

/** 견적·수납·정정이 같이 받는 결산 선택입니다. */
export interface SettlementOptions {
  /** 서버 안에서 끝나는 결제(현금·계좌이체·선수금)입니다. */
  payments?: ReadonlyArray<CheckoutPayment>
  useOverpaidCredit?: OverpaidCreditTarget | null
  writeOffRemainder?: boolean
  acknowledge?: ReadonlyArray<'OUTSTANDING'>
}

/** 영수증에 남기는 선택입니다. */
export interface ReceiptOptions {
  excludeFromTaxDeduction?: boolean
  memo?: string
}

/** 새 영수증이 쓰는 ID입니다. 서비스가 만들어 넘깁니다. */
export interface ReceiptIds {
  receiptId: Id<'receipt'>
  /** 요청의 결제 중 0원이 아닌 것에 줄 ID입니다. 요청 순서대로 커지는 ID를 `count`개 돌려줍니다. */
  paymentIds: (count: number) => ReadonlyArray<Id<'payment'>>
}

/** 밖에서 승인되는 결제 수단입니다. 수납 요청의 `payments`로 보내면 `PAYMENT_METHOD_NOT_ALLOWED`입니다. */
const EXTERNAL_METHODS: ReadonlySet<PaymentMethod> = new Set(ExternalPaymentMethod.literals)

/**
 * 수납할 수 있는 내원인지입니다. 이미 수납했거나 취소한 내원, 다시 열었지만 유효한 영수증이 남은 내원은 금액을
 * 보기 전에 거절합니다. 그런 내원의 견적은 받을 수 없는 금액을 보여 주기 때문입니다.
 */
export function checkoutable(
  visit: Visit,
  activeReceipt: ReceiptRecord | null,
): Result.Result<void, VisitTransitionInvalid | ReceiptAlreadyExists> {
  if (visit.status === 'COMPLETED' || visit.status === 'CANCELED') {
    return Result.fail(new VisitTransitionInvalid({ currentStatus: visit.status, command: 'CHECKOUT' }))
  }
  if (activeReceipt !== null) return Result.fail(new ReceiptAlreadyExists({ receiptId: activeReceipt.id }))
  return Result.void
}

/**
 * 이 내원의 진료 중 고른 것의 받을 금액입니다. 고르지 않으면 철회하지 않은 진료 전부입니다. `encounters`는 환자의
 * 진료이고, 이 내원의 철회하지 않은 진료만 고를 수 있습니다.
 *
 * 급여 본인부담은 내원의 자격과 진료일 기준 만 나이로 계산합니다. 보험구분을 바꾼 진료는 접수 때 받은 자격과
 * 맞지 않아 계산하지 않습니다.
 */
export function selectDues(
  visit: Visit,
  encounters: ReadonlyArray<Encounter>,
  birthDate: string | null,
  encounterIds: ReadonlyArray<Id<'encounter'>> | undefined,
): Result.Result<
  { ids: Array<Id<'encounter'>>; dues: EncounterDue[] },
  CheckoutEncounterInvalid | CheckoutCoverageUnsupported
> {
  const all = encounters.filter((each) => each.visitId === visit.id && each.status !== 'ENTERED_IN_ERROR')
  const byId = new Map(all.map((each) => [each.id as string, each]))
  const ids = encounterIds === undefined ? all.map((each) => each.id) : [...new Set(encounterIds)]
  const invalid = ids.filter((id) => !byId.has(id))
  if (invalid.length > 0) return Result.fail(new CheckoutEncounterInvalid({ encounterIds: invalid }))

  const age = birthDate === null ? null : ageOn(birthDate, visit.date)
  const dues: EncounterDue[] = []
  const unsupported: Array<Id<'encounter'>> = []
  for (const id of ids) {
    const encounter = byId.get(id)!
    const basis: CopayBasis =
      encounter.coverage === visit.coverage
        ? copayBasis({ ...visit, benefitFlags: encounter.benefitFlags })
        : { kind: 'UNSUPPORTED' }
    const due = encounterDue(encounter, { basis, age })
    if (due === null) unsupported.push(id)
    else dues.push(due)
  }
  if (unsupported.length > 0) return Result.fail(new CheckoutCoverageUnsupported({ encounterIds: unsupported }))
  return Result.succeed({ ids: ids as Array<Id<'encounter'>>, dues })
}

/**
 * 고른 미리 기록한 결제입니다. 이 환자의 결제이고 아직 적용하지 않았으며, 내원을 정했다면 이 내원이어야 합니다.
 * `found`는 요청한 ID로 읽은 결제입니다. 받은 시각 순서로 돌려줍니다.
 */
export function applicablePayments(
  visit: Visit,
  paymentIds: ReadonlyArray<Id<'payment'>> | undefined,
  found: ReadonlyArray<Payment>,
): Result.Result<Payment[], CheckoutPaymentInvalid> {
  const ids = [...new Set(paymentIds ?? [])]
  const byId = new Map(found.map((each) => [each.id as string, each]))
  const notApplicable = ids.filter((id) => {
    const payment = byId.get(id)
    return (
      payment === undefined ||
      payment.status !== 'UNAPPLIED' ||
      payment.patientId !== visit.patientId ||
      (payment.visitId !== null && payment.visitId !== visit.id)
    )
  })
  if (notApplicable.length > 0) return Result.fail(new CheckoutPaymentInvalid({ paymentIds: notApplicable }))
  return Result.succeed(ids.map((id) => byId.get(id)!).sort(byRecorded))
}

/**
 * 결산입니다. 이미 받은 결제(`held`, 미리 기록했거나 정정으로 옮긴 결제)는 환불하고 남은 금액으로, 요청의
 * 결제(`payments`)와 함께 넣습니다. 요청의 결제에 밖에서 승인되는 수단이 있으면 `PAYMENT_METHOD_NOT_ALLOWED`입니다.
 */
export function settle(dues: ReadonlyArray<EncounterDue>, held: ReadonlyArray<Payment>, input: SettlementOptions) {
  const payments = input.payments ?? []
  const settlement = settleCheckout({
    encounters: dues,
    payments: [...held.map((each) => ({ method: each.method, amount: refundableOf(each) })), ...payments],
    overpaidCreditBalance: 0,
    useOverpaidCredit: input.useOverpaidCredit ?? null,
    prepaidBalances: { CASH_LIKE: 0, CARD_LIKE: 0 },
    writeOffRemainder: input.writeOffRemainder ?? false,
    acknowledge: input.acknowledge ?? [],
  })
  const errors = settlement.errors.includes('PAYMENT_METHOD_NOT_ALLOWED')
    ? settlement.errors
    : normalizedPayments(payments).some((each) => EXTERNAL_METHODS.has(each.method))
      ? ['PAYMENT_METHOD_NOT_ALLOWED' as const, ...settlement.errors]
      : settlement.errors
  return { settlement, errors }
}

/** 결산이 막으면 422 `CHECKOUT_REJECTED`입니다. 확인받지 않은 경고도 막습니다. */
export function acceptSettlement(
  settled: ReturnType<typeof settle>,
): Result.Result<ReturnType<typeof settle>['settlement'], CheckoutRejected> {
  const { settlement, errors } = settled
  if (errors.length > 0 || settlement.warnings.length > 0) {
    return Result.fail(new CheckoutRejected({ errors, warnings: settlement.warnings }))
  }
  return Result.succeed(settlement)
}

/** 새 영수증을 쓰는 데 필요한 것입니다. `receipt`는 응답에 줄 결제까지 담은 모양입니다. */
export interface NewReceipt {
  receipt: Receipt
  event: DomainEvent
  changes: {
    insertReceipts: ReceiptRecord[]
    updatePayments: Array<{ payment: Payment; expectedVersion: number }>
    insertPayments: Payment[]
  }
}

/**
 * 새 영수증과 그 결제입니다. 이미 받은 결제(`held`)는 이 영수증으로 옮기고(미리 기록한 결제는 `CAPTURED`로),
 * 요청의 0원 아닌 결제는 새로 만듭니다. `receipt.created`를 냅니다.
 */
export function newReceipt(input: {
  visit: Visit
  ids: ReadonlyArray<Id<'encounter'>>
  dues: ReadonlyArray<EncounterDue>
  held: ReadonlyArray<Payment>
  payments: ReadonlyArray<CheckoutPayment>
  settlement: ReturnType<typeof settle>['settlement']
  options: ReceiptOptions
  correctionOf: Id<'receipt'> | null
  receiptIds: ReceiptIds
  context: DecisionContext
}): NewReceipt {
  const { at } = input.context
  const id = input.receiptIds.receiptId
  const received = input.payments.filter((each) => each.amount.taxable + each.amount.taxExempt !== 0)
  const freshIds = input.receiptIds.paymentIds(received.length)
  const held = input.held.map((each): Payment => ({
    ...each,
    receiptId: id,
    visitId: each.visitId ?? input.visit.id,
    status: each.status === 'UNAPPLIED' ? 'CAPTURED' : each.status,
    updatedAt: at,
    version: each.version + 1,
  }))
  const fresh = received.map((each, index): Payment => ({
    id: freshIds[index]!,
    tenantId: input.context.tenantId,
    patientId: input.visit.patientId,
    visitId: input.visit.id,
    receiptId: id,
    method: each.method,
    prepaidKind: each.prepaidKind ?? null,
    amount: each.amount,
    processorRef: null,
    status: 'CAPTURED',
    refunds: [],
    recordedBy: input.context.userId,
    createdAt: at,
    updatedAt: at,
    version: 1,
  }))
  const { settlement } = input
  const record: ReceiptRecord = {
    id,
    tenantId: input.context.tenantId,
    visitId: input.visit.id,
    patientId: input.visit.patientId,
    date: input.context.today,
    cashierId: input.context.userId,
    memo: input.options.memo ?? '',
    encounterIds: input.ids,
    quoteId: quoteIdOf(input.dues),
    charges: chargesOf(input.dues),
    settlement: {
      due: settlement.due,
      received: settlement.received,
      result: settlement.result,
      outstanding: settlement.outstanding,
      overpaid: settlement.overpaid,
      writtenOff: settlement.writtenOff,
      acknowledged: settlement.acknowledged,
    },
    flags: { excludeFromTaxDeduction: input.options.excludeFromTaxDeduction ?? false },
    status: 'ACTIVE',
    voided: null,
    correctionOf: input.correctionOf,
    createdAt: at,
    updatedAt: at,
    version: 1,
  }
  const receipt: Receipt = { ...record, payments: [...held, ...fresh].sort(byRecorded).map(toReceiptPayment) }
  const event = domainEvent(
    'receipt.created',
    id,
    at,
    {
      receiptId: id,
      visitId: input.visit.id,
      patientId: input.visit.patientId,
      date: record.date,
      total: record.charges.total,
      result: settlement.result,
      acknowledged: settlement.acknowledged,
      paymentIds: receipt.payments.map((each) => each.id),
      correctionOf: input.correctionOf,
    },
    eventContext(input.context),
  )
  return {
    receipt,
    event,
    changes: {
      insertReceipts: [record],
      updatePayments: input.held.map((each, index) => ({ payment: held[index]!, expectedVersion: each.version })),
      insertPayments: fresh,
    },
  }
}

/** 취소 판정 결과입니다. 영수증과 받지 않은 것으로 바뀐 결제를 한 트랜잭션에 씁니다. */
export interface VoidDecision {
  receipt: ReceiptRecord
  expectedVersion: number
  /** 받지 않은 것으로 `VOIDED`가 된 결제입니다. 저장된 버전은 하나 아래입니다. */
  voided: Payment[]
  /** 정정에서 새 영수증으로 옮길, 밖에서 취소해야 하는 결제입니다. 단순 취소면 비어 있습니다. */
  carried: Payment[]
  event: DomainEvent
}

/**
 * 수납 취소를 판정합니다. 서버 안에서 받은 결제(현금·계좌이체)는 받지 않은 것으로 `VOIDED`가 됩니다. 밖에서
 * 취소해야 하는 결제(카드·간편결제)가 남았으면, 단순 취소는 409 `PAYMENT_REFUND_REQUIRED`이고 정정(`correctedBy`)은
 * 그 결제를 새 영수증으로 옮깁니다. 이미 취소한 영수증은 409 `RECEIPT_VOIDED`입니다. `receipt.voided`를 냅니다.
 *
 * 내원은 그대로 둡니다. 다시 수납하려면 `:reopen` 뒤 수납합니다.
 */
export function decideVoid(
  receipt: ReceiptRecord,
  payments: ReadonlyArray<Payment>,
  input: { reason: string; correctedBy?: Id<'receipt'> },
  context: DecisionContext,
): Result.Result<VoidDecision, ReceiptVoided | PaymentRefundRequired> {
  if (receipt.status === 'VOIDED') return Result.fail(new ReceiptVoided({}))
  const decision = voidReceipt(receipt, payments, {
    reason: input.reason,
    at: context.at,
    by: context.userId,
    ...(input.correctedBy === undefined ? {} : { correctedBy: input.correctedBy }),
  })
  if (!decision.ok) {
    return Result.fail(new PaymentRefundRequired({ receiptId: receipt.id, paymentIds: decision.paymentIds }))
  }
  const event = domainEvent(
    'receipt.voided',
    receipt.id,
    context.at,
    {
      receiptId: receipt.id,
      visitId: receipt.visitId,
      patientId: receipt.patientId,
      date: receipt.date,
      reason: input.reason,
      correctedBy: input.correctedBy ?? null,
    },
    eventContext(context),
  )
  return Result.succeed({
    receipt: decision.receipt,
    expectedVersion: receipt.version,
    voided: decision.voided,
    carried: decision.carried,
    event,
  })
}

/** 정정 입력입니다. 진료는 앞 영수증의 진료 그대로이고, 결제와 결산 선택을 다시 받습니다. */
export interface CorrectionInput extends SettlementOptions, ReceiptOptions {
  reason: string
  paymentIds?: ReadonlyArray<Id<'payment'>>
}

/** 정정을 판정할 때 서비스가 미리 읽어 두는 사실입니다. */
export interface CorrectionFacts {
  /** 앞 영수증의 결제입니다. */
  payments: ReadonlyArray<Payment>
  /** 영수증의 내원입니다. */
  visit: Visit
  /** 환자의 진료입니다. */
  encounters: ReadonlyArray<Encounter>
  birthDate: string | null
  /** 요청한 미리 기록한 결제를 ID로 읽은 것입니다. */
  requestedPayments: ReadonlyArray<Payment>
}

/**
 * 수납 정정을 판정합니다. 앞 영수증을 취소하고 같은 진료로 새 영수증을 만듭니다(`correctionOf`). 영수증·결제를 한
 * 트랜잭션에 묶는 경계입니다(domain-model.md 묶은 경계). 밖에서 취소해야 하는 결제는 환불하지 않고 새 영수증으로
 * 옮기고, 서버 안에서 받은 결제는 취소한 뒤 요청의 `payments`로 다시 받습니다. 결산은 수납과 같습니다.
 *
 * 고치지 않은 메모·소득공제 제외는 앞 영수증 것을 이어받습니다. 결제만 바꾸는 정정이 연말정산 표시를 되돌리지
 * 않게 합니다. 내원 상태는 바꾸지 않습니다.
 */
export function decideCorrection(
  receipt: ReceiptRecord,
  input: CorrectionInput,
  facts: CorrectionFacts,
  receiptIds: ReceiptIds,
  context: DecisionContext,
): Result.Result<
  { voided: VoidDecision; created: NewReceipt },
  ReceiptVoided | CheckoutEncounterInvalid | CheckoutCoverageUnsupported | CheckoutPaymentInvalid | CheckoutRejected
> {
  if (receipt.status === 'VOIDED') return Result.fail(new ReceiptVoided({}))
  const selected = selectDues(facts.visit, facts.encounters, facts.birthDate, receipt.encounterIds)
  if (Result.isFailure(selected)) return Result.fail(selected.failure)
  const applied = applicablePayments(facts.visit, input.paymentIds, facts.requestedPayments)
  if (Result.isFailure(applied)) return Result.fail(applied.failure)

  const voided = decideVoid(
    receipt,
    facts.payments,
    { reason: input.reason, correctedBy: receiptIds.receiptId },
    context,
  )
  // 정정은 밖에서 취소할 결제를 옮기므로 환불로 막히지 않고, 취소한 영수증은 위에서 걸렀습니다
  if (Result.isFailure(voided)) throw new Error(`correction of ${receipt.id} was blocked: ${voided.failure._tag}`)

  const { ids, dues } = selected.success
  const held = [...voided.success.carried, ...applied.success].sort(byRecorded)
  const settlement = acceptSettlement(settle(dues, held, input))
  if (Result.isFailure(settlement)) return Result.fail(settlement.failure)

  const created = newReceipt({
    visit: facts.visit,
    ids,
    dues,
    held,
    payments: input.payments ?? [],
    settlement: settlement.success,
    options: {
      memo: input.memo ?? receipt.memo,
      excludeFromTaxDeduction: input.excludeFromTaxDeduction ?? receipt.flags.excludeFromTaxDeduction,
    },
    correctionOf: receipt.id,
    receiptIds,
    context,
  })
  return Result.succeed({ voided: voided.success, created })
}
