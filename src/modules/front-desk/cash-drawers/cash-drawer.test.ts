import { describe, expect, it } from 'vitest'
import { cashDrawerStatus, cashFlow, closingDifference } from './cash-drawer.ts'

describe('cashFlow', () => {
  it('counts only cash payments, charges and refunds', () => {
    const flow = cashFlow(100_000, [
      { kind: 'PAYMENT', method: 'CASH', amount: 30_000 },
      { kind: 'PAYMENT', method: 'CARD', amount: 20_000 },
      { kind: 'PAYMENT', method: 'BANK_TRANSFER', amount: 5000 },
      { kind: 'PAYMENT', method: 'PREPAID', amount: 7000 },
      { kind: 'PREPAID_CHARGE', method: 'CASH', amount: 10_000 },
      { kind: 'PREPAID_CHARGE', method: 'CARD', amount: 50_000 },
      { kind: 'REFUND', method: 'CASH', amount: 3000 },
      { kind: 'REFUND', method: 'CARD_CANCEL', amount: 2000 },
      { kind: 'EXPENSE', amount: 4000 },
    ])
    expect(flow).toEqual({ cashIn: 40_000, cashRefunds: 3000, expenses: 4000, expectedClosing: 133_000 })
  })

  it('can go negative', () => {
    expect(cashFlow(0, [{ kind: 'EXPENSE', amount: 1000 }]).expectedClosing).toBe(-1000)
  })
})

describe('closingDifference', () => {
  it('is counted minus expected', () => {
    expect(closingDifference(120_000, 120_001)).toBe(-1)
  })
})

describe('cashDrawerStatus', () => {
  it('reopens when the ledger changes after closing', () => {
    expect(cashDrawerStatus({ opened: true, closed: true, reopenedSinceLastClose: true })).toBe('REOPENED')
    expect(cashDrawerStatus({ opened: true, closed: true, reopenedSinceLastClose: false })).toBe('CLOSED')
  })
})
