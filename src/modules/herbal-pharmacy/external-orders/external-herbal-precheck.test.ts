import { describe, expect, it } from 'vitest'
import {
  externalPaymentAmountMismatch,
  externalPrecheckGate,
  externalPrecheckMessage,
  herbLineQuantity,
  packBasedQuantity,
  parseExternalPrecheck,
} from './external-herbal-precheck.ts'

describe('precheck 응답 읽기 (parseExternalPrecheck)', () => {
  it('알 수 없는 줄 실패는 UNKNOWN으로 두고 원문 코드를 남깁니다', () => {
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

  it('본문이 없거나 배열이 아닌 필드는 빈 실패로 읽습니다', () => {
    expect(parseExternalPrecheck(null)).toEqual({ ok: false, errors: [], lineIssues: [] })
    expect(parseExternalPrecheck({ ok: false, lines: 'x', errors: 'y' })).toEqual({
      ok: false,
      errors: [],
      lineIssues: [],
    })
  })

  it('ok가 true가 아니면 참으로 읽히는 값이어도 실패입니다', () => {
    expect(parseExternalPrecheck({ ok: 'true' }).ok).toBe(false)
    expect(parseExternalPrecheck([]).ok).toBe(false)
  })
})

describe('precheck 판정 (externalPrecheckGate)', () => {
  it('탕전원에 닿지 못하면 503으로 막습니다', () => {
    expect(externalPrecheckGate({ kind: 'UNREACHABLE' })).toEqual({
      ok: false,
      status: 503,
      code: 'EXTERNAL_PRECHECK_UNAVAILABLE',
    })
  })

  it('주문 단위 오류가 없으면 줄 실패만으로 문구를 만듭니다', () => {
    const result = parseExternalPrecheck({ ok: false, lines: [{ ok: false, code: 'OUT_OF_STOCK' }, { ok: false }] })
    expect(externalPrecheckMessage(result)).toBe('주문 확인 실패: 재고 부족, 수량 불일치')
  })

  it('ok인 결과만 통과시킵니다', () => {
    expect(externalPrecheckGate({ kind: 'RESPONDED', body: { ok: true } })).toEqual({
      ok: true,
      result: { ok: true, errors: [], lineIssues: [] },
    })
  })
})

describe('약재 줄 주문 수량 (herbLineQuantity)', () => {
  it('첩당 용량을 0.1g 단위로 반올림(0.05는 올림)한 뒤 첩수를 곱합니다', () => {
    expect(herbLineQuantity(2.05, 10)).toBe(21)
    expect(herbLineQuantity(2.049, 10)).toBe(20)
    expect(herbLineQuantity(0.04, 10)).toBe(0)
    expect(herbLineQuantity(-1, 10)).toBe(0)
  })

  it('요청 스키마가 막았어야 할 첩수와 용량은 예외를 던집니다', () => {
    expect(() => herbLineQuantity(3, 1.5)).toThrow(RangeError)
    expect(() => herbLineQuantity(3, Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => herbLineQuantity(1.0000001, 10)).toThrow(RangeError)
  })
})

describe('팩 단위 과금 수량 (packBasedQuantity)', () => {
  it('과금팩수가 없으면 팩이 0이어도 1이고, 있으면 팩수로 나눕니다', () => {
    expect(packBasedQuantity(0, null)).toBe(1)
    expect(packBasedQuantity(0, 20)).toBe(0)
  })
})

describe('결제수단 금액 검사 (externalPaymentAmountMismatch)', () => {
  it('합이 맞으면 일반카드가 몇 장이든 받습니다', () => {
    const methods = [
      { type: 'CARD' as const, amount: 10000 },
      { type: 'CARD' as const, amount: 20000 },
      { type: 'DEPOSIT_CARD' as const, amount: 5000 },
    ]
    expect(externalPaymentAmountMismatch(methods, 35000)).toBeNull()
  })

  it('결제액 0원은 수단 없이 통과하고, 결제액이 있는데 수단이 없으면 합계 오류입니다', () => {
    expect(externalPaymentAmountMismatch([], 0)).toBeNull()
    expect(externalPaymentAmountMismatch([], 10000)).toEqual({
      code: 'PAYMENT_AMOUNT_MISMATCH',
      reason: 'TOTAL',
      payable: 10000,
      total: 0,
    })
  })

  it('합이 맞아도 금액이 음수인 수단이 있으면 오류입니다', () => {
    const methods = [
      { type: 'CARD' as const, amount: 20000 },
      { type: 'DEPOSIT_CARD' as const, amount: -5000 },
    ]
    expect(externalPaymentAmountMismatch(methods, 15000)?.reason).toBe('NON_POSITIVE_AMOUNT')
  })
})
