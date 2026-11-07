import { describe, expect, it } from 'vitest'
import { gradeDiscount, settleCheckout } from './checkout-settlement.ts'
import type { CheckoutInput } from './checkout-settlement.types.ts'

function input(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    encounters: [
      { encounterId: 'enc_1', due: { taxable: 5000, taxExempt: 10_000 }, insuredCopay: 6000, jejuSubsidy: 0 },
    ],
    payments: [{ method: 'CASH', amount: { taxable: 5000, taxExempt: 10_000 } }],
    overpaidCreditBalance: 0,
    prepaidBalances: { CASH_LIKE: 0, CARD_LIKE: 0 },
    ...overrides,
  }
}

describe('수납 결산 (settleCheckout)', () => {
  it('받을 금액을 다 받으면 PAID입니다', () => {
    expect(settleCheckout(input())).toMatchObject({ result: 'PAID', remaining: 0, accepted: true })
  })

  it('제주 지원금은 비과세 받을 금액 전체가 아니라 급여 본인부담까지입니다', () => {
    const encounters = [
      { encounterId: 'enc_1', due: { taxable: 0, taxExempt: 10_000 }, insuredCopay: 6000, jejuSubsidy: 9000 },
    ]
    const settlement = settleCheckout(input({ encounters, payments: [], acknowledge: ['OUTSTANDING'] }))
    expect(settlement.jejuSubsidy).toBe(6000)
    expect(settlement.effectiveDue).toEqual({ taxable: 0, taxExempt: 4000 })
  })

  it('미수 금액과 과수납 금액을 알립니다', () => {
    const short = settleCheckout(input({ payments: [{ method: 'CARD', amount: { taxable: 0, taxExempt: 10_000 } }] }))
    expect(short).toMatchObject({ result: 'OUTSTANDING', outstanding: 5000, overpaid: 0, accepted: true })
    const over = settleCheckout(input({ payments: [{ method: 'CARD', amount: { taxable: 6000, taxExempt: 10_000 } }] }))
    expect(over).toMatchObject({ result: 'OVERPAID', outstanding: 0, overpaid: 1000 })
  })

  it('남은 금액이 양수면 손비처리합니다', () => {
    const settlement = settleCheckout(input({ payments: [], writeOffRemainder: true }))
    expect(settlement).toMatchObject({ result: 'WRITTEN_OFF', warnings: [], accepted: true })
  })

  it('입력 결제가 없으면 과수납금을 써도 미수 확인을 받습니다', () => {
    const settlement = settleCheckout(
      input({ payments: [], overpaidCreditBalance: 3000, useOverpaidCredit: 'TAX_EXEMPT' }),
    )
    expect(settlement).toMatchObject({ result: 'OUTSTANDING', outstanding: 12_000, warnings: ['OUTSTANDING'] })
    expect(settlement.overpaidCreditApplied).toEqual({ taxable: 0, taxExempt: 3000 })
  })

  it('과수납금이 받을 금액을 모두 덮으면 미수 확인을 받지 않습니다', () => {
    const encounters = [
      { encounterId: 'enc_1', due: { taxable: 0, taxExempt: 2000 }, insuredCopay: 2000, jejuSubsidy: 0 },
    ]
    const settlement = settleCheckout(
      input({ encounters, payments: [], overpaidCreditBalance: 3000, useOverpaidCredit: 'TAX_EXEMPT' }),
    )
    expect(settlement).toMatchObject({ result: 'PAID', warnings: [], accepted: true })
  })

  it('미수 확인을 정할 때 0원 결제는 없는 것으로 봅니다', () => {
    const settlement = settleCheckout(input({ payments: [{ method: 'CASH', amount: { taxable: 0, taxExempt: 0 } }] }))
    expect(settlement.warnings).toEqual(['OUTSTANDING'])
  })

  it.each([
    [{ method: 'JEJU_SUBSIDY' as const, amount: { taxable: 0, taxExempt: 1000 } }, 'PAYMENT_METHOD_NOT_ALLOWED'],
    [{ method: 'OVERPAID_CREDIT' as const, amount: { taxable: 0, taxExempt: 1000 } }, 'PAYMENT_METHOD_NOT_ALLOWED'],
    [{ method: 'PACKAGE' as const, amount: { taxable: 0, taxExempt: 1000 } }, 'PAYMENT_METHOD_NOT_ALLOWED'],
    [{ method: 'PREPAID' as const, amount: { taxable: 0, taxExempt: 1000 } }, 'PREPAID_KIND_REQUIRED'],
  ])('결제 %o는 %s로 거절합니다', (payment, code) => {
    expect(settleCheckout(input({ payments: [payment] })).errors).toEqual([code])
  })

  it.each([-1, 0.5])('요청 스키마가 막았어야 할 결제 금액 %s는 예외를 던집니다', (taxable) => {
    expect(() => settleCheckout(input({ payments: [{ method: 'CASH', amount: { taxable, taxExempt: 0 } }] }))).toThrow(
      RangeError,
    )
  })

  it('처방 수정으로 음수가 된 부분은 다른 부분과 합산합니다', () => {
    const encounters = [
      { encounterId: 'enc_1', due: { taxable: 5000, taxExempt: -2000 }, insuredCopay: 0, jejuSubsidy: 0 },
    ]
    const payments = [{ method: 'CASH' as const, amount: { taxable: 3000, taxExempt: 0 } }]
    expect(settleCheckout(input({ encounters, payments }))).toMatchObject({ result: 'PAID', remaining: 0 })
  })

  it('제주 지원금을 과수납금보다 먼저 빼고 받을 금액 − 받은 금액이 맞습니다', () => {
    const encounters = [
      { encounterId: 'enc_1', due: { taxable: 0, taxExempt: 6000 }, insuredCopay: 6000, jejuSubsidy: 4000 },
    ]
    const settlement = settleCheckout(
      input({ encounters, payments: [], overpaidCreditBalance: 5000, useOverpaidCredit: 'TAX_EXEMPT' }),
    )
    expect(settlement).toMatchObject({
      jejuSubsidy: 4000,
      overpaidCreditApplied: { taxable: 0, taxExempt: 2000 },
      received: { taxable: 0, taxExempt: 6000 },
      result: 'PAID',
      warnings: [],
    })
  })

  it('제주 지원금은 진료별로 상한을 잡지 않고 합한 뒤 잡습니다', () => {
    const encounters = [
      { encounterId: 'enc_1', due: { taxable: 0, taxExempt: 5000 }, insuredCopay: 5000, jejuSubsidy: -1000 },
      { encounterId: 'enc_2', due: { taxable: 0, taxExempt: 5000 }, insuredCopay: 5000, jejuSubsidy: 3000 },
    ]
    expect(settleCheckout(input({ encounters, payments: [], acknowledge: ['OUTSTANDING'] })).jejuSubsidy).toBe(2000)
  })

  it('손비 금액과 확인받은 경고를 남깁니다', () => {
    expect(settleCheckout(input({ payments: [], writeOffRemainder: true })).writtenOff).toBe(15_000)
    expect(settleCheckout(input({ payments: [], acknowledge: ['OUTSTANDING'] }))).toMatchObject({
      acknowledged: ['OUTSTANDING'],
      accepted: true,
    })
  })

  it('선수금은 계열마다 그 계열 잔액과 견줍니다', () => {
    const prepaidBalances = { CASH_LIKE: 10_000, CARD_LIKE: 5000 }
    const fits = settleCheckout(
      input({
        prepaidBalances,
        payments: [
          { method: 'PREPAID', prepaidKind: 'CASH_LIKE', amount: { taxable: 0, taxExempt: 10_000 } },
          { method: 'PREPAID', prepaidKind: 'CARD_LIKE', amount: { taxable: 5000, taxExempt: 0 } },
        ],
      }),
    )
    expect(fits.errors).toEqual([])
    const over = settleCheckout(
      input({
        prepaidBalances,
        payments: [{ method: 'PREPAID', prepaidKind: 'CARD_LIKE', amount: { taxable: 5000, taxExempt: 1 } }],
      }),
    )
    expect(over.errors).toEqual(['PREPAID_BALANCE_INSUFFICIENT'])
  })
})

describe('환자 등급 할인 (gradeDiscount)', () => {
  it('일투여량이 소수여도 한 번만 반올림합니다', () => {
    // 1001 × 0.5 × 0.9 = 450.45 → 450. 원금액(500.5 → 501)을 먼저 반올림하면 451이 됩니다
    expect(gradeDiscount({ unitPrice: 1001, tax: 0, dailyDose: 0.5, days: 1, rate: 10 })).toEqual({
      original: 501,
      discounted: 450,
      discount: 51,
    })
  })

  it.each([-1, 101, 12.5])('할인율 %s%는 예외를 던집니다', (rate) => {
    expect(() => gradeDiscount({ unitPrice: 1000, tax: 0, dailyDose: 1, days: 1, rate })).toThrow(RangeError)
  })
})
