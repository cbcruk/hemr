import { describe, expect, it } from 'vitest'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { allowedRefundMethods, refundPayment, settlementAfterRefund, voidReceipt } from './receipt-adjustments.ts'
import type { Payment, ReceiptRecord, ReceiptSettlement } from './receipt.ts'

const AT = '2026-11-07T01:00:00.000Z'
const BY = 'usr_01JBQ000000000000000000001' as Id<'user'>

const payment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'pay_01JBQ000000000000000000001' as Id<'payment'>,
  tenantId: 'ten_01JBQ000000000000000000001' as Id<'tenant'>,
  patientId: 'pat_01JBQ000000000000000000001' as Id<'patient'>,
  visitId: 'vis_01JBQ000000000000000000001' as Id<'visit'>,
  receiptId: 'rcp_01JBQ000000000000000000001' as Id<'receipt'>,
  method: 'CASH',
  prepaidKind: null,
  amount: { taxable: 1_000, taxExempt: 9_000 },
  processorRef: null,
  status: 'CAPTURED',
  refunds: [],
  recordedBy: BY,
  createdAt: AT,
  updatedAt: AT,
  version: 1,
  ...overrides,
})

const settlement = (overrides: Partial<ReceiptSettlement> = {}): ReceiptSettlement => ({
  due: { taxable: 1_000, taxExempt: 9_000 },
  received: { taxable: 1_000, taxExempt: 9_000 },
  result: 'PAID',
  outstanding: 0,
  overpaid: 0,
  writtenOff: 0,
  acknowledged: [],
  ...overrides,
})

const request = (taxable: number, taxExempt: number, method: 'CASH' | 'CARD_CANCEL' = 'CASH', writeOff = false) => ({
  amount: { taxable, taxExempt },
  method,
  reason: '환불',
  writeOff,
  at: AT,
  by: BY,
})

describe('allowedRefundMethods', () => {
  it('follows the refund method table', () => {
    expect(allowedRefundMethods('CARD')).toEqual(['CARD_CANCEL'])
    expect(allowedRefundMethods('ZERO_PAY')).toEqual(['ZERO_PAY', 'BANK_TRANSFER', 'CASH'])
    expect(allowedRefundMethods('BANK_TRANSFER')).toEqual(['BANK_TRANSFER', 'CASH'])
    expect(allowedRefundMethods('JEJU_SUBSIDY')).toEqual([])
  })
})

describe('refundPayment', () => {
  it('refunds each part up to what is left and reports every reason it cannot', () => {
    const once = refundPayment(payment(), request(0, 4_000), null)
    if (!once.ok) throw new Error('expected a refund')
    const rejected = refundPayment(once.payment, request(1_001, 0, 'CARD_CANCEL'), null)
    const rest = refundPayment(once.payment, request(1_000, 5_000), null)

    expect(once.payment).toMatchObject({ status: 'PARTIALLY_REFUNDED', version: 2, refunds: [{ method: 'CASH' }] })
    expect(rejected).toEqual({
      ok: false,
      errors: ['METHOD_NOT_ALLOWED', 'AMOUNT_EXCEEDED'],
      allowedMethods: ['BANK_TRANSFER', 'CASH'],
      refundable: { taxable: 1_000, taxExempt: 5_000 },
    })
    expect(rest).toMatchObject({ ok: true, payment: { status: 'REFUNDED', version: 3 } })
  })

  it('refunds an unapplied payment only in full and never as a write-off', () => {
    const unapplied = payment({ method: 'CARD', status: 'UNAPPLIED', receiptId: null })
    expect(refundPayment(unapplied, request(0, 9_000, 'CARD_CANCEL'), null)).toMatchObject({
      ok: false,
      errors: ['PARTIAL_UNAPPLIED'],
    })
    expect(refundPayment(unapplied, request(1_000, 9_000, 'CARD_CANCEL', true), null)).toMatchObject({
      ok: true,
      refund: { writtenOff: 0 },
      payment: { status: 'REFUNDED', receiptId: null },
    })
  })
})

describe('settlementAfterRefund', () => {
  const refund = (taxExempt: number) => ({ taxable: 0, taxExempt })

  it('turns a refund into outstanding or written-off remainder', () => {
    expect(settlementAfterRefund(settlement(), refund(3_000), false)).toMatchObject({
      received: { taxable: 1_000, taxExempt: 6_000 },
      result: 'OUTSTANDING',
      outstanding: 3_000,
      writtenOff: 0,
    })
    expect(settlementAfterRefund(settlement(), refund(3_000), true)).toMatchObject({
      result: 'WRITTEN_OFF',
      outstanding: 0,
      writtenOff: 3_000,
    })
  })

  it('refunds an overpayment back to paid and writes off only what crosses into the remainder', () => {
    const overpaid = settlement({
      received: { taxable: 1_000, taxExempt: 12_000 },
      result: 'OVERPAID',
      overpaid: 3_000,
    })
    expect(settlementAfterRefund(overpaid, refund(3_000), true)).toMatchObject({
      result: 'PAID',
      overpaid: 0,
      writtenOff: 0,
    })
    expect(settlementAfterRefund(overpaid, refund(5_000), true)).toMatchObject({
      result: 'WRITTEN_OFF',
      outstanding: 0,
      writtenOff: 2_000,
    })
  })

  it('keeps an earlier write-off when a later refund is not written off', () => {
    const writtenOff = settlement({
      received: { taxable: 1_000, taxExempt: 7_000 },
      result: 'WRITTEN_OFF',
      writtenOff: 2_000,
    })
    expect(settlementAfterRefund(writtenOff, refund(1_000), false)).toMatchObject({
      result: 'OUTSTANDING',
      outstanding: 1_000,
      writtenOff: 2_000,
    })
  })
})

describe('refundPayment on an applied payment', () => {
  it('records the amount actually written off, not the request flag', () => {
    const overpaid = settlement({
      received: { taxable: 1_000, taxExempt: 12_000 },
      result: 'OVERPAID',
      overpaid: 3_000,
    })
    const card = payment({ method: 'CARD', amount: { taxable: 1_000, taxExempt: 12_000 } })
    expect(refundPayment(card, request(0, 3_000, 'CARD_CANCEL', true), overpaid)).toMatchObject({
      ok: true,
      refund: { writtenOff: 0 },
      settlement: { result: 'PAID' },
    })
    expect(refundPayment(card, request(0, 5_000, 'CARD_CANCEL', true), overpaid)).toMatchObject({
      ok: true,
      refund: { writtenOff: 2_000 },
      settlement: { result: 'WRITTEN_OFF', writtenOff: 2_000 },
    })
  })
})

describe('voidReceipt', () => {
  const receipt = {
    id: 'rcp_01JBQ000000000000000000001',
    status: 'ACTIVE',
    voided: null,
    version: 4,
  } as unknown as ReceiptRecord
  const card = payment({ id: 'pay_01JBQ000000000000000000002' as Id<'payment'>, method: 'CARD' })
  const refunded = payment({ id: 'pay_01JBQ000000000000000000003' as Id<'payment'>, status: 'REFUNDED' })

  it('blocks a plain void while terminal payments are not refunded', () => {
    expect(voidReceipt(receipt, [payment(), card], { reason: '잘못', at: AT, by: BY })).toEqual({
      ok: false,
      paymentIds: [card.id],
    })
  })

  it('voids in-server payments and carries terminal payments on a correction', () => {
    const correctedBy = 'rcp_01JBQ000000000000000000009' as Id<'receipt'>
    const decision = voidReceipt(receipt, [payment(), card, refunded], { reason: '정정', at: AT, by: BY, correctedBy })
    expect(decision).toMatchObject({
      ok: true,
      receipt: { status: 'VOIDED', voided: { reason: '정정', correctedBy }, version: 5 },
      voided: [{ id: payment().id, status: 'VOIDED', version: 2 }],
      carried: [{ id: card.id, status: 'CAPTURED' }],
    })
  })
})
