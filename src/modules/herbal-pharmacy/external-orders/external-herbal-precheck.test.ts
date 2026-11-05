import { describe, expect, it } from 'vitest'
import {
  externalPaymentAmountMismatch,
  externalPrecheckGate,
  externalPrecheckMessage,
  herbLineQuantity,
  packBasedQuantity,
  parseExternalPrecheck,
} from './external-herbal-precheck.ts'

describe('parseExternalPrecheck', () => {
  it('keeps the raw code of unknown line failures', () => {
    expect(
      parseExternalPrecheck({
        ok: false,
        lines: [{ ok: true }, { ok: false, code: 'QTY_MISMATCH' }, { ok: false }, 'broken'],
        errors: ['약재 단종', 3],
      }),
    ).toEqual({
      ok: false,
      errors: ['약재 단종'],
      lineIssues: [
        { line: 1, code: 'UNKNOWN', rawCode: 'QTY_MISMATCH' },
        { line: 2, code: 'UNKNOWN', rawCode: null },
        { line: 3, code: 'UNKNOWN', rawCode: null },
      ],
    })
  })

  it('reads null or non-array fields as an empty failure', () => {
    expect(parseExternalPrecheck(null)).toEqual({ ok: false, errors: [], lineIssues: [] })
    expect(parseExternalPrecheck({ ok: false, lines: 'x', errors: 'y' })).toEqual({
      ok: false,
      errors: [],
      lineIssues: [],
    })
  })

  it('treats a truthy but non-boolean ok as failure', () => {
    expect(parseExternalPrecheck({ ok: 'true' }).ok).toBe(false)
    expect(parseExternalPrecheck([]).ok).toBe(false)
  })
})

describe('externalPrecheckGate', () => {
  it('blocks with 503 when the provider is unreachable', () => {
    expect(externalPrecheckGate({ kind: 'UNREACHABLE' })).toEqual({
      ok: false,
      status: 503,
      code: 'EXTERNAL_PRECHECK_UNAVAILABLE',
    })
  })

  it('composes the message from line issues alone', () => {
    const result = parseExternalPrecheck({ ok: false, lines: [{ ok: false, code: 'OUT_OF_STOCK' }, { ok: false }] })
    expect(externalPrecheckMessage(result)).toBe('주문 확인 실패: 재고 부족, 수량 불일치')
  })

  it('passes only an ok result', () => {
    expect(externalPrecheckGate({ kind: 'RESPONDED', body: { ok: true } })).toEqual({
      ok: true,
      result: { ok: true, errors: [], lineIssues: [] },
    })
  })
})

describe('herbLineQuantity', () => {
  it('rounds the per-pack dose half up to 0.1g before multiplying', () => {
    expect(herbLineQuantity(2.05, 10)).toBe(21)
    expect(herbLineQuantity(2.049, 10)).toBe(20)
    expect(herbLineQuantity(0.04, 10)).toBe(0)
    expect(herbLineQuantity(-1, 10)).toBe(0)
  })

  it('rejects doses the request schema should have blocked', () => {
    expect(() => herbLineQuantity(3, 1.5)).toThrow(RangeError)
    expect(() => herbLineQuantity(3, Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => herbLineQuantity(1.0000001, 10)).toThrow(RangeError)
  })
})

describe('packBasedQuantity', () => {
  it('bills one unit when the billing unit is missing, even for zero packs', () => {
    expect(packBasedQuantity(0, null)).toBe(1)
    expect(packBasedQuantity(0, 20)).toBe(0)
  })
})

describe('externalPaymentAmountMismatch', () => {
  it('accepts any number of cards when the total matches', () => {
    const methods = [
      { type: 'CARD' as const, amount: 10000 },
      { type: 'CARD' as const, amount: 20000 },
      { type: 'DEPOSIT_CARD' as const, amount: 5000 },
    ]
    expect(externalPaymentAmountMismatch(methods, 35000)).toBeNull()
  })

  it('passes a free quote without methods and rejects a missing payment', () => {
    expect(externalPaymentAmountMismatch([], 0)).toBeNull()
    expect(externalPaymentAmountMismatch([], 10000)).toEqual({
      code: 'PAYMENT_AMOUNT_MISMATCH',
      reason: 'TOTAL',
      payable: 10000,
      total: 0,
    })
  })

  it('rejects a negative amount even when the total matches', () => {
    const methods = [
      { type: 'CARD' as const, amount: 20000 },
      { type: 'DEPOSIT_CARD' as const, amount: -5000 },
    ]
    expect(externalPaymentAmountMismatch(methods, 15000)?.reason).toBe('NON_POSITIVE_AMOUNT')
  })
})
