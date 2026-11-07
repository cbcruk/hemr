import { describe, expect, it } from 'vitest'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { Payment, Refund } from '../receipts/receipt.ts'
import { cashFlow } from './cash-drawer.ts'
import type { Expense } from './cash-drawer-model.ts'
import { cashLedger, ledgerFingerprint } from './cash-ledger.ts'

// 2026-11-07 병원 시간 오전 10시와 다음 날 오전 10시입니다
const DAY1 = '2026-11-07T01:00:00.000Z'
const DAY2 = '2026-11-08T01:00:00.000Z'
const user = 'usr_01JBQ000000000000000000001' as Id<'user'>

const payment = (id: string, overrides: Partial<Payment> = {}): Payment => ({
  id: `pay_01JBQ00000000000000000000${id}` as Id<'payment'>,
  tenantId: 'ten_01JBQ000000000000000000001' as Id<'tenant'>,
  patientId: 'pat_01JBQ000000000000000000001' as Id<'patient'>,
  visitId: null,
  receiptId: 'rcp_01JBQ000000000000000000001' as Id<'receipt'>,
  method: 'CASH',
  prepaidKind: null,
  amount: { taxable: 0, taxExempt: 10_000 },
  processorRef: null,
  status: 'CAPTURED',
  refunds: [],
  recordedBy: user,
  createdAt: DAY1,
  updatedAt: DAY1,
  version: 1,
  ...overrides,
})

const refund = (amount: number, method: Refund['method'], at: string): Refund => ({
  amount: { taxable: 0, taxExempt: amount },
  method,
  reason: '환불',
  writtenOff: 0,
  at,
  by: user,
})

const expense = (id: string, overrides: Partial<Expense> = {}): Expense => ({
  id: `exp_01JBQ00000000000000000000${id}` as Id<'expense'>,
  tenantId: 'ten_01JBQ000000000000000000001' as Id<'tenant'>,
  date: '2026-11-07',
  amount: 3_000,
  category: { id: 'exc_01JBQ000000000000000000001' as Id<'expenseCategory'>, name: '비품' },
  memo: '',
  recordedBy: user,
  createdAt: DAY1,
  deleted: null,
  version: 1,
  ...overrides,
})

const flowOn = (date: string, payments: Payment[], expenses: Expense[] = []) =>
  cashFlow(50_000, cashLedger(date, payments, expenses))

describe('cashLedger', () => {
  it('counts cash received, cash refunds and expenses of the day', () => {
    const payments = [
      payment('1'),
      payment('2', { method: 'CARD', status: 'CAPTURED' }),
      // 카드 결제를 현금으로 돌려주면 현금 환불입니다
      payment('3', {
        method: 'KAKAO_PAY',
        status: 'PARTIALLY_REFUNDED',
        refunds: [refund(2_000, 'CASH', DAY1)],
      }),
    ]
    expect(flowOn('2026-11-07', payments, [expense('1')])).toEqual({
      cashIn: 10_000,
      cashRefunds: 2_000,
      expenses: 3_000,
      expectedClosing: 55_000,
    })
  })

  it('counts each movement on the day the money moved', () => {
    const refunded = payment('1', {
      status: 'PARTIALLY_REFUNDED',
      refunds: [refund(4_000, 'CASH', DAY2)],
      updatedAt: DAY2,
    })
    expect(flowOn('2026-11-07', [refunded])).toMatchObject({ cashIn: 10_000, cashRefunds: 0 })
    expect(flowOn('2026-11-08', [refunded])).toMatchObject({ cashIn: 0, cashRefunds: 4_000 })
  })

  it('treats a voided cash payment as the rest handed back on a later void day and nets out a same-day void', () => {
    // 받은 날 취소한 금액은 오가지 않은 돈입니다. 그날 환불한 만큼만 받고 돌려준 것으로 셉니다
    const sameDay = payment('1', { status: 'VOIDED', updatedAt: DAY1 })
    expect(cashLedger('2026-11-07', [sameDay], [])).toEqual([])
    const refundedThenVoided = payment('3', {
      status: 'VOIDED',
      refunds: [refund(4_000, 'CASH', DAY1)],
      updatedAt: DAY1,
    })
    expect(flowOn('2026-11-07', [refundedThenVoided])).toMatchObject({ cashIn: 4_000, cashRefunds: 4_000 })

    const nextDay = payment('2', {
      status: 'VOIDED',
      refunds: [refund(4_000, 'CASH', DAY1)],
      updatedAt: DAY2,
    })
    expect(flowOn('2026-11-07', [nextDay])).toMatchObject({ cashIn: 10_000, cashRefunds: 4_000 })
    expect(flowOn('2026-11-08', [nextDay])).toMatchObject({ cashIn: 0, cashRefunds: 6_000 })
  })

  it('leaves out unapplied payments, deleted expenses and expenses of other days', () => {
    const unapplied = payment('1', { method: 'CARD', status: 'UNAPPLIED', receiptId: null })
    const expenses = [expense('1', { deleted: { at: DAY1, by: user } }), expense('2', { date: '2026-11-08' })]
    expect(cashLedger('2026-11-07', [unapplied], expenses)).toEqual([])
  })
})

describe('ledgerFingerprint', () => {
  it('changes only with cash movements and not with their order', () => {
    const cash = cashLedger('2026-11-07', [payment('1'), payment('2', { method: 'CARD' })], [expense('1')])
    const withoutCard = cashLedger('2026-11-07', [payment('1')], [expense('1')])
    expect(ledgerFingerprint(cash)).toBe(ledgerFingerprint(withoutCard))
    expect(ledgerFingerprint([...cash].reverse())).toBe(ledgerFingerprint(cash))
    expect(ledgerFingerprint(cashLedger('2026-11-07', [payment('1')], []))).not.toBe(ledgerFingerprint(cash))
  })
})
