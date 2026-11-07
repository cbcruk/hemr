import { describe, expect, it } from 'vitest'
import {
  KNOWN_LITE_RESERVED_NAMES,
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

describe('이름 중복 (hasNameConflict)', () => {
  it('앞뒤 공백을 뺀 이름으로 비교하고 자기 자신과 빈 이름은 중복이 아닙니다', () => {
    const existing = [{ id: 'a', name: ' 보중익기탕 ' }]
    expect(hasNameConflict(existing, '보중익기탕')).toBe(true)
    expect(hasNameConflict(existing, '보중익기탕', 'a')).toBe(false)
    expect(hasNameConflict(existing, '   ')).toBe(false)
  })

  it('분해형 한글도 같은 이름으로 봅니다', () => {
    expect(hasNameConflict([{ id: 'a', name: '약침' }], '약침'.normalize('NFD'))).toBe(true)
  })
})

describe('설정 위반 응답 (settingProblem)', () => {
  it('형식 위반, 업무 규칙 위반, 이름 중복 순서로 응답 상태를 정합니다', () => {
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

describe('임의처방 검증 (judgeArbitraryFormula)', () => {
  it('소수 사용량을 더해도 총 투약량 50g 경계가 정확합니다', () => {
    const herbs = Array.from({ length: 10 }, () => ({ upperPrice: 1, usageG: 4.99, specG: 1 }))
    const result = judgeArbitraryFormula('A', [...herbs, { upperPrice: 1, usageG: 0.1, specG: 1 }])
    expect(result.totalUsageG).toBe(50)
    expect(result.violations).toEqual([])
  })

  it('저장을 막는 위반을 필드와 함께 모두 적습니다', () => {
    expect(judgeArbitraryFormula(' ', [{ upperPrice: 10, usageG: 0, specG: 1 }]).violations).toEqual([
      { field: 'name', code: 'REQUIRED' },
      { field: 'herbs[0].usageG', code: 'INVALID_VALUE' },
      { field: 'herbs', code: 'ZERO_AMOUNT' },
    ])
  })

  it('음수, 유한하지 않은 수, 소수점 아래 6자리를 넘는 수는 예외 없이 위반으로 적고 합계에서 뺍니다', () => {
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

  it('부동소수로는 내림될 정확한 0.5도 올림합니다', () => {
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

describe('패키지', () => {
  it('과세 혼합 패키지를 위반으로 적고 소수 일투여량을 정확히 곱합니다', () => {
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

describe('비급여 금액 (nonbenefitPrice)', () => {
  it('부가세 포함으로 입력한 금액은 공급가로 저장합니다', () => {
    expect(nonbenefitPrice(10000, 'VAT_INCLUSIVE')).toEqual({ ok: true, unitPrice: 9091, taxType: 'TAXABLE', vat: 909 })
    expect(nonbenefitPrice(15, 'VAT_EXCLUSIVE')).toEqual({ ok: true, unitPrice: 15, taxType: 'TAXABLE', vat: 2 })
  })

  it('부가세 포함 입력도 입력한 금액에 상한을 적용합니다', () => {
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

  it('소수나 음수는 받지 않습니다', () => {
    expect(nonbenefitPrice(1.5, 'TAX_EXEMPT')).toEqual({
      ok: false,
      violation: { field: 'price', code: 'INVALID_VALUE' },
    })
    expect(nonbenefitPrice(-1, 'TAX_EXEMPT').ok).toBe(false)
  })
})

describe('비급여 항목 검증 (nonbenefitItemViolations)', () => {
  const existing = [{ id: 'n1', name: '약침A', code: '비001' }]

  it('이름 중복과 코드 중복을 함께 적습니다', () => {
    expect(nonbenefitItemViolations({ name: '약침A', code: '001' }, existing, KNOWN_LITE_RESERVED_NAMES)).toEqual([
      { field: 'name', code: 'SETTING_NAME_DUPLICATE' },
      { field: 'code', code: 'SETTING_NAME_DUPLICATE' },
    ])
  })

  it('수정할 때는 자기 자신을 뺍니다', () => {
    expect(nonbenefitItemViolations({ name: '약침A', code: '001' }, existing, KNOWN_LITE_RESERVED_NAMES, 'n1')).toEqual(
      [],
    )
  })

  it('코드 필수 위반과 라이트 서비스 전용 이름 위반을 함께 모읍니다', () => {
    expect(nonbenefitItemViolations({ name: ' 경옥고 ', code: ' ' }, [], KNOWN_LITE_RESERVED_NAMES)).toEqual([
      { field: 'code', code: 'REQUIRED' },
      { field: 'name', code: 'NONBENEFIT_NAME_RESERVED' },
    ])
  })

  it('현행처럼 코드 앞에 늘 비를 붙입니다', () => {
    expect(nonbenefitCode('001')).toBe('비001')
    expect(nonbenefitCode('비001')).toBe('비비001')
  })
})

describe('치료실 검증 (treatmentRoomViolations)', () => {
  const room = (name: string, bedCount: number) => ({ id: null, name, bedCount })

  it('앞뒤 공백을 뺀 이름을 20자까지 받습니다', () => {
    expect(treatmentRoomViolations(room('가'.repeat(21), 1), [])).toEqual([{ field: 'name', code: 'NAME_TOO_LONG' }])
    expect(treatmentRoomViolations(room(` ${'가'.repeat(20)} `, 1), [])).toEqual([])
  })

  it('베드 수는 1–20 정수만 받습니다', () => {
    for (const bedCount of [0, 2.5, Number.NaN, 21]) {
      expect(treatmentRoomViolations(room('A', bedCount), [])).toEqual([
        { field: 'bedCount', code: 'BED_COUNT_OUT_OF_RANGE' },
      ])
    }
    expect(treatmentRoomViolations(room('A', 20), [])).toEqual([])
  })

  it('치료실은 10개까지 만들 수 있습니다', () => {
    expect(canAddTreatmentRoom(9)).toBe(true)
    expect(canAddTreatmentRoom(10)).toBe(false)
    expect(canAddTreatmentRoom(11)).toBe(false)
  })
})
