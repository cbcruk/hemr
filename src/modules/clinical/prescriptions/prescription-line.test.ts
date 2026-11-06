import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { Dose, lineAmount, UnitPrice } from './prescription-line.ts'

describe('lineAmount', () => {
  it('multiplies the unit price by the dose and rounds half up to won', () => {
    expect(lineAmount(9_850, { perDay: 1, days: 1 })).toBe(9_850)
    expect(lineAmount(12_345, { perDay: 0.5, days: 3 })).toBe(18_518) // 18,517.5
    expect(lineAmount(0.1, { perDay: 0.3, days: 1 })).toBe(0) // 0.03, 부동소수로 곱해도 0.030000000000000002
    expect(lineAmount(1_234.55, { perDay: 1, days: 1 })).toBe(1_235)
    expect(lineAmount(1_234.49, { perDay: 1, days: 1 })).toBe(1_234)
  })

  it('stays exact beyond the safe integer range of the intermediate product', () => {
    expect(lineAmount(99_999_999.99, { perDay: 999.99, days: 365 })).toBe(36_499_634_996_350)
  })
})

describe('dose and unit price', () => {
  const valid = (schema: Schema.Top, value: unknown) => Schema.is(schema as Schema.Codec<unknown>)(value)

  it('takes up to two decimal places and refuses empty or negative amounts', () => {
    expect(valid(Dose, { perDay: 0.5, days: 7 })).toBe(true)
    expect(valid(Dose, { perDay: 0.333, days: 7 })).toBe(false)
    expect(valid(Dose, { perDay: 0, days: 7 })).toBe(false)
    expect(valid(Dose, { perDay: 1, days: 0 })).toBe(false)
    expect(valid(Dose, { perDay: 1, days: 1.5 })).toBe(false)
    expect(valid(UnitPrice, 0)).toBe(true)
    expect(valid(UnitPrice, 1_234.56)).toBe(true)
    expect(valid(UnitPrice, 1_234.567)).toBe(false)
    expect(valid(UnitPrice, -1)).toBe(false)
    // 둘째 자리에 아주 가까운 값도 받지 않습니다. 받으면 금액 계산이 실패합니다
    expect(valid(UnitPrice, 1.000000001)).toBe(false)
    expect(valid(UnitPrice, 1e-9)).toBe(false)
    expect(valid(Dose, { perDay: 0.010000001, days: 1 })).toBe(false)
    expect(valid(UnitPrice, 1.15)).toBe(true)
    expect(valid(UnitPrice, 99_999_999.99)).toBe(true)
  })
})
