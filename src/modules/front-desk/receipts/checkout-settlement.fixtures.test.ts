import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  gradeDiscount,
  normalizedPayments,
  overpaidCreditApplied,
  settleCheckout,
  suggestPrepaidSplit,
  sumEncounters,
} from './checkout-settlement.ts'
import type {
  CheckoutPayment,
  EncounterDue,
  OverpaidCreditTarget,
  PaymentMethod,
  SettlementResult,
} from './checkout-settlement.types.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/checkout-settlement.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 입력(한글 키, 문자열 금액)을 `CheckoutInput`으로 바꾸고, 결정
 * (`docs/design/rule-decisions.md`의 checkout-settlement)에 따른 기대값으로 검사합니다.
 * 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/checkout-settlement.json'), 'utf8'),
) as { cases: FixtureCase[] }

const METHOD: Record<string, PaymentMethod> = { 카드: 'CARD', 현금: 'CASH', 통장: 'BANK_TRANSFER', 선수금: 'PREPAID' }
const STATUS: Record<string, SettlementResult> = { 미수: 'OUTSTANDING', 과수납: 'OVERPAID', 손비: 'WRITTEN_OFF' }
const PREPAID_ROW = { CASH_LIKE: '선수금-현금', CARD_LIKE: '선수금-카드' } as const
const NO_PREPAID = { CASH_LIKE: 0, CARD_LIKE: 0 }

function amountOf(value: string | undefined): number {
  return value === undefined || value === '' ? 0 : Number(value)
}

/** 현행 결제 행을 결제로 바꿉니다. 제주 지원금 행은 서버가 만들므로 뺍니다. */
function toPayments(rows: Record<string, string>[]): CheckoutPayment[] {
  return rows
    .filter((row) => row['결제수단'] !== '제주지원금')
    .map((row) => ({
      method: METHOD[row['결제수단']!]!,
      amount: { taxable: amountOf(row['과세']), taxExempt: amountOf(row['비과세']) },
    }))
}

/** 현행은 비과세 받을 금액을 급여 본인부담과 나누지 않습니다. 비과세 전부를 급여 본인부담으로 봅니다. */
function toEncounter(taxExempt: number, taxable: number, jejuSubsidy: number, id = 'enc'): EncounterDue {
  return { encounterId: id, due: { taxable, taxExempt }, insuredCopay: taxExempt, jejuSubsidy }
}

/** 선택한 진료에 수납 화면의 처방 증감(`edits`)을 더합니다. 서버는 바뀐 처방으로 금액을 다시 계산합니다. */
function selectedEncounters(input: Record<string, any>): EncounterDue[] {
  return (input['receipts'] as any[])
    .filter((receipt) => (input['selected'] as string[]).includes(receipt['진료Id']))
    .map((receipt) => {
      const edit = input['edits']?.[receipt['진료Id']] ?? { 비과세: 0, 과세: 0 }
      return toEncounter(
        receipt['비과세미수금액'] + edit.비과세,
        receipt['과세미수금액'] + edit.과세,
        receipt['제주지원금'] ?? 0,
        receipt['진료Id'],
      )
    })
}

function creditTarget(flags: { 비과세?: boolean; 과세?: boolean } | undefined): OverpaidCreditTarget | null {
  if (flags?.비과세) return 'TAX_EXEMPT'
  if (flags?.과세) return 'TAXABLE'
  return null
}

function cases(check: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['check'] === check && !(testCase.name in NOT_PORTED))
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, Record<string, unknown>> = {
  // 결정 2: 과수납인데 손비를 요청하면 끄지 않고 거부합니다
  'settle: 과수납 wins over 손비 and 손비 is turned off': { result: 'OVERPAID', errors: ['WRITE_OFF_OVERPAID'] },
  // 결정 2: 손비할 금액이 0이면 손비 요청을 무시합니다
  'settle: 손비 with zero remaining still reports 손비': { result: 'PAID' },
  // 결정 4: 제주 행은 급여 본인부담(비과세 3,000)까지입니다
  'settle: Jeju subsidy larger than non-taxable due clamps to 0': { jejuSubsidy: 3000 },
  'jeju: subsidy equals due': { 제주지원금: 1000 },
  'jeju: due includes taxable part when capping': { 제주지원금: 1000 },
  // 결정 8: 과수납금을 골라도 남은 금액이 있고 입력 결제가 없으면 묻습니다(과수납 잔액은 픽스처에 없어 0)
  'confirm: overpaid credit chosen -> no ask': { ask: true },
  // 결정 6: 카드 계열 잔액이 0이라 제안대로 내면 거부합니다
  'prepaid: negative cash balance treated as 0': { errors: ['PREPAID_BALANCE_INSUFFICIENT'] },
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'settle: negative 과수금액 is added to non-taxable due':
    '음수 과수금액의 뜻은 질문 5에서 보류했습니다. 재설계는 과수납 잔액과 미수를 따로 두므로 음수 잔액이 없고, 지금 서버는 음수 잔액을 0으로 봐서 현행의 "더 받을 금액"을 더하지 않습니다',
  'settle: non-numeric input counts as 0': '요청 스키마가 숫자가 아닌 금액을 400 VALIDATION_FAILED로 거부합니다',
  'payload: treatment with remaining due sends 미수 amounts, otherwise full amounts':
    '현행 요청 본문 모양입니다. 서버는 encounterIds만 받고 금액을 직접 계산합니다',
  'payload: 전액 미수 toggle zeroes all rows and clears credit and 손비':
    '화면 토글입니다. 서버에서는 결제 없이 acknowledge: ["OUTSTANDING"]을 보내는 것과 같습니다',
}

describe('수납 결산 픽스처', () => {
  describe('결산 (결정 1·2·3·4)', () => {
    it.each(cases('settle').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const settlement = settleCheckout({
        encounters: [toEncounter(input['받을금액_비과세'], input['받을금액_과세'], input['제주지원금'])],
        payments: toPayments(input['결제내역']),
        overpaidCreditBalance: input['과수금액'],
        useOverpaidCredit: creditTarget(input['과수납금사용여부']),
        prepaidBalances: NO_PREPAID,
        writeOffRemainder: input['손비처리'] === true,
      })
      const want = {
        result: expected.남은금액상태 === null ? 'PAID' : STATUS[expected.남은금액상태],
        errors: [],
        ...CHANGED[name],
      }

      expect(settlement.effectiveDue).toEqual({
        taxExempt: expected.effectiveDue비과세,
        taxable: expected.effectiveDue과세,
      })
      expect(settlement.entered).toEqual({
        taxExempt: expected.총_수납_금액_비과세,
        taxable: expected.총_수납_금액_과세,
      })
      expect(settlement.remaining).toBe(expected.총_미수_금액_비과세 + expected.총_미수_금액_과세)
      expect(settlement).toMatchObject(want)
      expect(settlement.jejuSubsidy).toBe(CHANGED[name]?.['jejuSubsidy'] ?? input['제주지원금'])
      expect(settlement.outstanding).toBe(settlement.result === 'OUTSTANDING' ? settlement.remaining : 0)
      expect(settlement.overpaid).toBe(settlement.result === 'OVERPAID' ? -settlement.remaining : 0)
    })
  })

  describe('제주 지원금 행 (결정 4: 급여 본인부담까지)', () => {
    it.each(cases('jejuSubsidyLine').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const settlement = settleCheckout({
        encounters: selectedEncounters(input),
        payments: [],
        overpaidCreditBalance: 0,
        prepaidBalances: NO_PREPAID,
        acknowledge: ['OUTSTANDING'],
      })
      const want = { ...expected, ...CHANGED[name] }

      expect(settlement.due.taxExempt + settlement.due.taxable).toBe(want.selectedDue)
      expect(settlement.jejuSubsidy).toBe(want.제주지원금)
    })
  })

  describe('받을 금액 과세·비과세 나누기', () => {
    it.each(cases('dueSplit').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const { due } = sumEncounters(selectedEncounters({ ...input, edits: {} }))
      expect(due).toEqual({ taxExempt: expected.비과세, taxable: expected.과세 })
    })
  })

  describe('미수 확인 (결정 8: 결산과 같은 계산)', () => {
    it.each(cases('needsOutstandingConfirm').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const settlement = settleCheckout({
        encounters: [toEncounter(input['a'], 0, input['n'])],
        payments: input['o'] > 0 ? [{ method: 'CASH', amount: { taxable: 0, taxExempt: input['o'] } }] : [],
        overpaidCreditBalance: 0,
        useOverpaidCredit: creditTarget(input['과수납금사용여부']),
        prepaidBalances: NO_PREPAID,
        writeOffRemainder: input['손비처리'],
        // 전액 미수는 결제 없이 미수를 확인한 요청입니다
        acknowledge: input['전액미수처리'] ? ['OUTSTANDING'] : [],
      })
      const ask = (CHANGED[name]?.['ask'] as boolean | undefined) ?? expected

      expect(settlement.warnings.includes('OUTSTANDING')).toBe(ask)
    })
  })

  describe('과수납금 사용', () => {
    it.each(cases('overpaidCreditApplied').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const due = { taxExempt: input['받을금액_비과세'], taxable: input['받을금액_과세'] }
      expect(overpaidCreditApplied(due, input['과수금액'], creditTarget(input['과수납금사용여부']))).toEqual({
        taxExempt: expected.비과세,
        taxable: expected.과세,
      })
    })
  })

  describe('결제 행 (결정 6: 선수금 계열 분할은 제안이고 수납은 잔액을 검사)', () => {
    it.each(cases('toPaymentRows').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const balances = { CASH_LIKE: input['선수금잔액']['현금'], CARD_LIKE: input['선수금잔액']['카드'] }
      const payments = toPayments(input['결제내역']).flatMap((payment) =>
        payment.method === 'PREPAID' ? suggestPrepaidSplit(payment.amount, balances) : normalizedPayments([payment]),
      )
      const rows = payments.map((payment) => ({
        결제수단: payment.prepaidKind
          ? PREPAID_ROW[payment.prepaidKind]
          : Object.keys(METHOD).find((key) => METHOD[key] === payment.method),
        비과세_진료비: payment.amount.taxExempt,
        과세_진료비: payment.amount.taxable,
      }))
      expect(rows).toEqual(expected)

      const settlement = settleCheckout({
        encounters: [toEncounter(100_000, 0, 0)],
        payments,
        overpaidCreditBalance: 0,
        prepaidBalances: balances,
      })
      expect(settlement.errors).toEqual(CHANGED[name]?.['errors'] ?? [])
    })
  })

  describe('환자 등급 할인 (결정 7: 정수 반올림)', () => {
    it.each(cases('gradeDiscount').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const result = gradeDiscount({
        unitPrice: input['단가'],
        tax: input['세금'],
        dailyDose: input['일투여량'],
        days: input['투약일수'],
        rate: input['할인율'],
      })
      expect(result).toEqual({
        original: expected.원금액,
        discounted: expected.할인후금액,
        discount: expected.할인금액,
      })
    })
  })

  describe('과수납일 때 손비처리 (결정 2)', () => {
    /** 현행 손비 체크박스를 막던 남은 금액 상태를 서버 결산 입력으로 만듭니다. */
    const PAYMENT_FOR_STATUS: Record<string, number> = { 과수납: 12_000, 미수: 5000 }

    it.each(cases('writeOffEnabled').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const paid = PAYMENT_FOR_STATUS[input['남은금액상태']]
      expect(paid).toBeDefined()
      const settlement = settleCheckout({
        encounters: [toEncounter(10_000, 0, 0)],
        payments: [{ method: 'CASH', amount: { taxable: 0, taxExempt: paid! } }],
        overpaidCreditBalance: 0,
        prepaidBalances: NO_PREPAID,
        writeOffRemainder: true,
      })
      expect(settlement.errors.includes('WRITE_OFF_OVERPAID')).toBe(expected.disabled)
    })
  })

  it('픽스처 사례마다 옮겼거나 옮기지 않은 이유를 적었고 따로 적은 사례 이름은 모두 픽스처에 있습니다', () => {
    const ported = new Set([
      'settle',
      'jejuSubsidyLine',
      'dueSplit',
      'needsOutstandingConfirm',
      'overpaidCreditApplied',
      'toPaymentRows',
      'gradeDiscount',
      'writeOffEnabled',
    ])
    const unaccounted = fixture.cases.filter(
      (testCase) => !(testCase.name in NOT_PORTED) && !ported.has(testCase.input['check']),
    )
    expect(unaccounted.map((testCase) => testCase.name)).toEqual([])
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
