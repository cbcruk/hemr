import { describe, expect, it } from 'vitest'
import {
  KNOWN_SOO_RESERVED_NAMES,
  canAddTreatmentRoom,
  hasNameConflict,
  judgeArbitraryFormula,
  nonbenefitCode,
  nonbenefitItemViolations,
  nonbenefitPrice,
  packageItemAmount,
  packageTaxViolations,
  settingProblem,
  treatmentRoomViolations,
} from './settings-validation.ts'

describe('hasNameConflict', () => {
  it('compares trimmed names and skips the item itself', () => {
    const existing = [{ id: 'a', name: ' 보중익기탕 ' }]
    expect(hasNameConflict(existing, '보중익기탕')).toBe(true)
    expect(hasNameConflict(existing, '보중익기탕', 'a')).toBe(false)
    expect(hasNameConflict(existing, '   ')).toBe(false)
  })

  it('treats decomposed Hangul as the same name', () => {
    expect(hasNameConflict([{ id: 'a', name: '약침' }], '약침'.normalize('NFD'))).toBe(true)
  })
})

describe('settingProblem', () => {
  it('ranks format errors, then rule violations, then duplicates', () => {
    const duplicate = { field: 'name', code: 'SETTING_NAME_DUPLICATE' }
    const rule = { field: 'bedCount', code: 'BED_COUNT_OUT_OF_RANGE' }
    const required = { field: 'name', code: 'REQUIRED' }
    expect(settingProblem([], 'X')).toBeNull()
    expect(settingProblem([duplicate], 'X')).toMatchObject({ status: 409, code: 'SETTING_NAME_DUPLICATE' })
    expect(settingProblem([duplicate, rule], 'X')).toMatchObject({
      status: 422,
      code: 'X',
      violations: [duplicate, rule],
    })
    expect(settingProblem([rule, required], 'X')).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' })
  })
})

describe('judgeArbitraryFormula', () => {
  it('keeps the 50g boundary exact with decimal usage', () => {
    const herbs = Array.from({ length: 10 }, () => ({ upperPrice: 1, usageG: 4.99, specG: 1 }))
    const result = judgeArbitraryFormula('A', [...herbs, { upperPrice: 1, usageG: 0.1, specG: 1 }])
    expect(result.totalUsageG).toBe(50)
    expect(result.violations).toEqual([])
  })

  it('lists every blocker with its field', () => {
    expect(judgeArbitraryFormula(' ', [{ upperPrice: 10, usageG: 0, specG: 1 }]).violations).toEqual([
      { field: 'name', code: 'REQUIRED' },
      { field: 'herbs[0].usageG', code: 'INVALID_VALUE' },
      { field: 'herbs', code: 'ZERO_AMOUNT' },
    ])
  })

  it('rejects negative, non-finite or over-precise numbers without throwing', () => {
    const result = judgeArbitraryFormula('A', [
      { upperPrice: 100, usageG: -1, specG: 1 },
      { upperPrice: Number.NaN, usageG: 1, specG: 1 },
      { upperPrice: 100, usageG: 0.0000001, specG: 1 },
      { upperPrice: 100, usageG: 1, specG: 0 },
      { upperPrice: 100, usageG: 1, specG: 1 },
    ])
    expect(result.violations).toEqual([
      { field: 'herbs[0].usageG', code: 'INVALID_VALUE' },
      { field: 'herbs[1].upperPrice', code: 'INVALID_VALUE' },
      { field: 'herbs[2].usageG', code: 'INVALID_VALUE' },
      { field: 'herbs[3].specG', code: 'INVALID_VALUE' },
    ])
    expect(result.herbAmounts).toEqual([0, 0, 0, 0, 100])
    expect(result.totalUsageG).toBe(1)
  })

  it('rounds exact halves up where floating point would round down', () => {
    // 1.005 × 1000 = 1004.9999… 이지만 십진으로는 1005입니다
    expect(judgeArbitraryFormula('A', [{ upperPrice: 1000, usageG: 1.005, specG: 1 }]).herbAmounts).toEqual([1005])
    // 0.35 × 3 ÷ 2 = 0.525 → 1, 2.5 × 1 ÷ 1 = 2.5 → 3
    expect(
      judgeArbitraryFormula('A', [
        { upperPrice: 3, usageG: 0.35, specG: 2 },
        { upperPrice: 1, usageG: 2.5, specG: 1 },
      ]).herbAmounts,
    ).toEqual([1, 3])
  })
})

describe('package', () => {
  it('reports a mixed package and multiplies a fractional daily dose exactly', () => {
    expect(packageTaxViolations([{ taxType: 'TAXABLE' }, { taxType: 'TAX_EXEMPT' }])).toEqual([
      { field: 'items', code: 'PACKAGE_TAX_MIXED' },
    ])
    expect(packageTaxViolations([{ taxType: 'TAXABLE' }])).toEqual([])
    // (100 + 10) × 0.1 × 3 = 33 (부동소수로는 33.000000000000004)
    expect(packageItemAmount({ unitPrice: 100, taxType: 'TAXABLE', perDay: 0.1, days: 3 })).toEqual({
      tax: 10,
      amount: 33,
    })
  })
})

describe('nonbenefitPrice', () => {
  it('stores the supply price of a VAT-inclusive entry', () => {
    expect(nonbenefitPrice(10000, 'VAT_INCLUSIVE')).toEqual({ ok: true, unitPrice: 9091, taxType: 'TAXABLE', vat: 909 })
    expect(nonbenefitPrice(15, 'VAT_EXCLUSIVE')).toEqual({ ok: true, unitPrice: 15, taxType: 'TAXABLE', vat: 2 })
  })

  it('applies the limit to the entered amount, also for VAT-inclusive entry', () => {
    expect(nonbenefitPrice(10_000_000, 'VAT_INCLUSIVE')).toEqual({
      ok: true,
      unitPrice: 9_090_909,
      taxType: 'TAXABLE',
      vat: 909_091,
    })
    expect(nonbenefitPrice(10_000_001, 'VAT_INCLUSIVE')).toEqual({
      ok: false,
      violation: { field: 'price', code: 'NONBENEFIT_PRICE_EXCEEDED' },
    })
  })

  it('rejects fractions or negatives', () => {
    expect(nonbenefitPrice(1.5, 'TAX_EXEMPT')).toEqual({
      ok: false,
      violation: { field: 'price', code: 'INVALID_VALUE' },
    })
    expect(nonbenefitPrice(-1, 'TAX_EXEMPT').ok).toBe(false)
  })
})

describe('nonbenefitItemViolations', () => {
  const existing = [{ id: 'n1', name: '약침A', code: '비001' }]

  it('reports name and code duplicates together', () => {
    expect(nonbenefitItemViolations({ name: '약침A', code: '001' }, existing, KNOWN_SOO_RESERVED_NAMES)).toEqual([
      { field: 'name', code: 'SETTING_NAME_DUPLICATE' },
      { field: 'code', code: 'SETTING_NAME_DUPLICATE' },
    ])
  })

  it('excludes the item itself on update', () => {
    expect(nonbenefitItemViolations({ name: '약침A', code: '001' }, existing, KNOWN_SOO_RESERVED_NAMES, 'n1')).toEqual(
      [],
    )
  })

  it('requires a code and accumulates every violation', () => {
    expect(nonbenefitItemViolations({ name: ' 경옥고 ', code: ' ' }, [], KNOWN_SOO_RESERVED_NAMES)).toEqual([
      { field: 'code', code: 'REQUIRED' },
      { field: 'name', code: 'NONBENEFIT_NAME_RESERVED' },
    ])
  })

  it('always prefixes 비 like the current client', () => {
    expect(nonbenefitCode('001')).toBe('비001')
    expect(nonbenefitCode('비001')).toBe('비비001')
  })
})

describe('treatmentRoomViolations', () => {
  const room = (name: string, bedCount: number) => ({ id: null, name, bedCount })

  it('limits the trimmed name to 20 characters', () => {
    expect(treatmentRoomViolations(room('가'.repeat(21), 1), [])).toEqual([{ field: 'name', code: 'NAME_TOO_LONG' }])
    expect(treatmentRoomViolations(room(` ${'가'.repeat(20)} `, 1), [])).toEqual([])
  })

  it('accepts only integer bed counts from 1 to 20', () => {
    for (const bedCount of [0, 2.5, Number.NaN, 21]) {
      expect(treatmentRoomViolations(room('A', bedCount), [])).toEqual([
        { field: 'bedCount', code: 'BED_COUNT_OUT_OF_RANGE' },
      ])
    }
    expect(treatmentRoomViolations(room('A', 20), [])).toEqual([])
  })

  it('allows up to 10 rooms', () => {
    expect(canAddTreatmentRoom(9)).toBe(true)
    expect(canAddTreatmentRoom(10)).toBe(false)
    expect(canAddTreatmentRoom(11)).toBe(false)
  })
})
