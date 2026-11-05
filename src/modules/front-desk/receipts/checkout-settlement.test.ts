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

describe('settleCheckout', () => {
  it('settles exactly paid checkouts as PAID', () => {
    expect(settleCheckout(input())).toMatchObject({ result: 'PAID', remaining: 0, accepted: true })
  })

  it('caps the Jeju subsidy at the insured copay, not the whole tax-exempt due', () => {
    const encounters = [
      { encounterId: 'enc_1', due: { taxable: 0, taxExempt: 10_000 }, insuredCopay: 6000, jejuSubsidy: 9000 },
    ]
    const settlement = settleCheckout(input({ encounters, payments: [], acknowledge: ['OUTSTANDING'] }))
    expect(settlement.jejuSubsidy).toBe(6000)
    expect(settlement.effectiveDue).toEqual({ taxable: 0, taxExempt: 4000 })
  })

  it('reports outstanding and overpaid amounts', () => {
    const short = settleCheckout(input({ payments: [{ method: 'CARD', amount: { taxable: 0, taxExempt: 10_000 } }] }))
    expect(short).toMatchObject({ result: 'OUTSTANDING', outstanding: 5000, overpaid: 0, accepted: true })
    const over = settleCheckout(input({ payments: [{ method: 'CARD', amount: { taxable: 6000, taxExempt: 10_000 } }] }))
    expect(over).toMatchObject({ result: 'OVERPAID', outstanding: 0, overpaid: 1000 })
  })

  it('writes off a positive remainder', () => {
    const settlement = settleCheckout(input({ payments: [], writeOffRemainder: true }))
    expect(settlement).toMatchObject({ result: 'WRITTEN_OFF', warnings: [], accepted: true })
  })

  it('asks to confirm outstanding when nothing is paid, even with overpaid credit', () => {
    const settlement = settleCheckout(
      input({ payments: [], overpaidCreditBalance: 3000, useOverpaidCredit: 'TAX_EXEMPT' }),
    )
    expect(settlement).toMatchObject({ result: 'OUTSTANDING', outstanding: 12_000, warnings: ['OUTSTANDING'] })
    expect(settlement.overpaidCreditApplied).toEqual({ taxable: 0, taxExempt: 3000 })
  })

  it('does not ask when overpaid credit covers the whole due', () => {
    const encounters = [
      { encounterId: 'enc_1', due: { taxable: 0, taxExempt: 2000 }, insuredCopay: 2000, jejuSubsidy: 0 },
    ]
    const settlement = settleCheckout(
      input({ encounters, payments: [], overpaidCreditBalance: 3000, useOverpaidCredit: 'TAX_EXEMPT' }),
    )
    expect(settlement).toMatchObject({ result: 'PAID', warnings: [], accepted: true })
  })

  it('ignores zero-amount payments when deciding to ask', () => {
    const settlement = settleCheckout(input({ payments: [{ method: 'CASH', amount: { taxable: 0, taxExempt: 0 } }] }))
    expect(settlement.warnings).toEqual(['OUTSTANDING'])
  })

  it.each([
    [{ method: 'JEJU_SUBSIDY' as const, amount: { taxable: 0, taxExempt: 1000 } }, 'PAYMENT_METHOD_NOT_ALLOWED'],
    [{ method: 'OVERPAID_CREDIT' as const, amount: { taxable: 0, taxExempt: 1000 } }, 'PAYMENT_METHOD_NOT_ALLOWED'],
    [{ method: 'PACKAGE' as const, amount: { taxable: 0, taxExempt: 1000 } }, 'PAYMENT_METHOD_NOT_ALLOWED'],
    [{ method: 'PREPAID' as const, amount: { taxable: 0, taxExempt: 1000 } }, 'PREPAID_KIND_REQUIRED'],
  ])('rejects %o with %s', (payment, code) => {
    expect(settleCheckout(input({ payments: [payment] })).errors).toEqual([code])
  })

  it.each([-1, 0.5])('throws on a payment amount of %s that the schema should have rejected', (taxable) => {
    expect(() => settleCheckout(input({ payments: [{ method: 'CASH', amount: { taxable, taxExempt: 0 } }] }))).toThrow(
      RangeError,
    )
  })

  it('sums a negative part from an edit with the other part', () => {
    const encounters = [
      { encounterId: 'enc_1', due: { taxable: 5000, taxExempt: -2000 }, insuredCopay: 0, jejuSubsidy: 0 },
    ]
    const payments = [{ method: 'CASH' as const, amount: { taxable: 3000, taxExempt: 0 } }]
    expect(settleCheckout(input({ encounters, payments }))).toMatchObject({ result: 'PAID', remaining: 0 })
  })

  it('applies Jeju before overpaid credit and keeps due − received consistent', () => {
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

  it('sums subsidies before capping them', () => {
    const encounters = [
      { encounterId: 'enc_1', due: { taxable: 0, taxExempt: 5000 }, insuredCopay: 5000, jejuSubsidy: -1000 },
      { encounterId: 'enc_2', due: { taxable: 0, taxExempt: 5000 }, insuredCopay: 5000, jejuSubsidy: 3000 },
    ]
    expect(settleCheckout(input({ encounters, payments: [], acknowledge: ['OUTSTANDING'] })).jejuSubsidy).toBe(2000)
  })

  it('records the written-off amount and the acknowledged warning', () => {
    expect(settleCheckout(input({ payments: [], writeOffRemainder: true })).writtenOff).toBe(15_000)
    expect(settleCheckout(input({ payments: [], acknowledge: ['OUTSTANDING'] }))).toMatchObject({
      acknowledged: ['OUTSTANDING'],
      accepted: true,
    })
  })

  it('checks each prepaid kind against its own balance', () => {
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

describe('gradeDiscount', () => {
  it('rounds a fractional dose only once', () => {
    // 1001 × 0.5 × 0.9 = 450.45 → 450. 원금액(500.5 → 501)을 먼저 반올림하면 451이 됩니다
    expect(gradeDiscount({ unitPrice: 1001, tax: 0, dailyDose: 0.5, days: 1, rate: 10 })).toEqual({
      original: 501,
      discounted: 450,
      discount: 51,
    })
  })

  it.each([-1, 101, 12.5])('rejects a %s% rate', (rate) => {
    expect(() => gradeDiscount({ unitPrice: 1000, tax: 0, dailyDose: 1, days: 1, rate })).toThrow(RangeError)
  })
})
