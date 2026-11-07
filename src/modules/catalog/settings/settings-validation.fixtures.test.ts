import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  arbitraryFormulaMessages,
  canAddToPackage,
  canAddTreatmentRoom,
  KNOWN_SOO_RESERVED_NAMES,
  hasNameConflict,
  judgeArbitraryFormula,
  nonbenefitCode,
  nonbenefitItemViolations,
  nonbenefitPrice,
  packageItemAmount,
  packageTaxMix,
  treatmentRoomViolations,
} from './settings-validation.ts'
import type { NonbenefitPriceEntry, TaxType } from './settings-validation.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/settings-validation.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 기대값 중 입력 중 자르기·blur 되돌리기·라벨·안내 배너처럼 화면에만 있는 값은 비교하지 않고, 서버가 판정하는
 * 저장 가능 여부·금액·중복만 같은 모양으로 줄여 비교합니다. 현행 과세구분 `별도`·`포함`은 `TAXABLE`, 그 밖은
 * `TAX_EXEMPT`로 읽습니다. 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/settings-validation.json'), 'utf8'),
) as { cases: FixtureCase[] }

const taxTypeOf = (legacy: string | null): TaxType =>
  legacy === '별도' || legacy === '포함' ? 'TAXABLE' : 'TAX_EXEMPT'

const PRICE_ENTRY: Record<string, NonbenefitPriceEntry> = {
  별도: 'VAT_EXCLUSIVE',
  포함: 'VAT_INCLUSIVE',
  면세: 'TAX_EXEMPT',
}

const digits = (value: string) => Number(value.replace(/\D/g, '') || '0')

const FIELD: Record<string, string> = { 처방명: 'name', 코드: 'code' }

/** 픽스처 검사별로 서버 결과와 현행 기대값을 같은 모양으로 만듭니다. */
const RUN: Record<string, { server: (input: any) => unknown; legacy: (expected: any) => unknown }> = {
  arbitraryFormula: {
    server: (input) => {
      const herbs = (input['구성약재'] as any[]).map((herb) => ({
        upperPrice: Number(herb['상한금액']),
        usageG: Number(herb['사용량']),
        specG: Number(herb['규격']),
      }))
      const result = judgeArbitraryFormula(input['처방명'], herbs)
      const codes = result.violations.map((each) => each.code)
      return {
        totalUsageG: result.totalUsageG,
        totalAmount: result.totalAmount,
        herbAmounts: result.herbAmounts,
        usageExceeded: codes.includes('TOTAL_USAGE_EXCEEDED'),
        amountExceeded: codes.includes('TOTAL_AMOUNT_EXCEEDED'),
        herbCountExceeded: codes.includes('HERB_COUNT_EXCEEDED'),
        canSave: result.violations.length === 0,
        errors: arbitraryFormulaMessages(result.violations),
      }
    },
    legacy: (expected) => ({
      totalUsageG: expected['총사용량'],
      totalAmount: expected['총금액'],
      herbAmounts: expected['계산금액목록'],
      usageExceeded: expected['사용량초과'],
      amountExceeded: expected['금액초과'],
      herbCountExceeded: expected['총약재초과'],
      canSave: expected['canSave'],
      errors: expected['errors'],
    }),
  },
  packageMix: {
    server: (input) => {
      const items = (input['items'] as any[]).map((each) => ({ taxType: taxTypeOf(each['과세구분']) }))
      const mix = packageTaxMix(items)
      const candidate = input['candidate']
      return {
        taxable: mix.taxable,
        valid: !mix.mixed,
        ...(candidate === undefined
          ? {}
          : { canAdd: canAddToPackage(items, { taxType: taxTypeOf(candidate['과세구분']) }) }),
      }
    },
    legacy: (expected) => ({
      taxable: expected['is과세패키지'],
      valid: expected['isValid'],
      ...('canAddCandidate' in expected ? { canAdd: expected['canAddCandidate'] } : {}),
    }),
  },
  packageItemAmount: {
    server: (input) => {
      // 현행 `포함` 단가는 부가세 포함 진료비이므로 등록할 때처럼 공급가로 바꿉니다 (결정 3)
      const price = nonbenefitPrice(input['단가'], PRICE_ENTRY[input['과세구분']] ?? 'TAX_EXEMPT')
      if (!price.ok) throw new Error('unexpected price violation')
      const { tax, amount } = packageItemAmount({
        unitPrice: price.unitPrice,
        taxType: price.taxType,
        perDay: input['일투여량'],
        days: input['투약일수'],
      })
      return { 세금: tax, 금액: amount }
    },
    legacy: (expected) => expected,
  },
  nonBenefitAmount: {
    server: (input) => {
      const price = nonbenefitPrice(digits(input['input']), PRICE_ENTRY[input['과세구분']]!)
      if (!price.ok) return { exceeded: true }
      return {
        exceeded: false,
        unitPrice: price.unitPrice,
        vat: price.vat,
        inclusiveSupply: input['과세구분'] === '포함' ? price.unitPrice : 0,
      }
    },
    // 현행은 빈 입력을 화면에서 0으로 채웁니다. 서버는 받은 값만 판정하므로 `digits`가 같은 기본값을 둡니다
    legacy: (expected) =>
      expected['errorMessage'] !== ''
        ? { exceeded: true }
        : {
            exceeded: false,
            unitPrice: Number(expected['단가']),
            vat: expected['VAT금액'],
            inclusiveSupply: expected['포함시단가표시'],
          },
  },
  nonBenefitAmountUnclamped: {
    server: (input) => ({ exceeded: !nonbenefitPrice(digits(input['rawValue']), PRICE_ENTRY[input['과세구분']]!).ok }),
    legacy: (expected) => ({ exceeded: expected['errorMessage'] !== '' }),
  },
  nonBenefitRegister: {
    server: (input) => {
      const existing = (input['existingItems'] as any[]).map((each, index) => ({
        id: `n${index}`,
        name: each['처방명'],
        code: each['코드'],
      }))
      const violations = nonbenefitItemViolations(
        { name: input['처방명'], code: input['코드'] },
        existing,
        KNOWN_SOO_RESERVED_NAMES,
      )
      return violations.length === 0
        ? { blocked: false, code: nonbenefitCode(input['코드']) }
        : { blocked: true, field: violations[0]!.field }
    },
    legacy: (expected) =>
      expected['blocked']
        ? { blocked: true, field: FIELD[expected['field']] }
        : { blocked: false, code: expected['payload']['비급여코드'] },
  },
  treatmentRoom: {
    server: (input) => {
      const existing = (input['existingRooms'] as any[]).map((each) => ({
        id: each['치료실Id'],
        name: each['치료실명'],
      }))
      const room = { id: input['id'] || null, name: input['치료실명'], bedCount: Number(input['베드수']) }
      const violations = treatmentRoomViolations(room, existing)
      return {
        canSave: violations.length === 0,
        duplicate: violations.some((each) => each.code === 'SETTING_NAME_DUPLICATE'),
      }
    },
    legacy: (expected) => ({ canSave: expected['canSave'], duplicate: expected['nameError'] !== '' }),
  },
  roomCount: {
    server: (input) => ({ allowed: canAddTreatmentRoom(input['existingRoomCount']) }),
    legacy: (expected) => ({ allowed: expected['allowed'] }),
  },
  personalFormulaName: {
    server: (input) => ({
      duplicate: hasNameConflict(
        (input['existingNames'] as string[]).map((name, index) => ({ id: `f${index}`, name })),
        input['처방명'],
      ),
    }),
    legacy: (expected) => expected,
  },
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 5: 총 투약량을 십진 고정소수로 더합니다
  'arbitraryFormula: float sum 0.1+0.2 weight': {
    totalUsageG: 0.3,
    totalAmount: 300,
    herbAmounts: [100, 200],
    usageExceeded: false,
    amountExceeded: false,
    herbCountExceeded: false,
    canSave: true,
    errors: [],
  },
  // 결정 3: `포함` 진료비 10,000원은 공급가 9,091원 + 부가세 909원입니다
  'packageItemAmount: 포함 also adds 10% on top': { 세금: 909, 금액: 10000 },
  // 결정 2: 10,000,000원을 넘으면 자르지 않고 422입니다
  'nonBenefitAmount: 10,000,001 clamped to 10,000,000 on input': { exceeded: true },
  // 결정 3: `포함` 진료비 11,000원은 공급가 10,000원으로 저장합니다 (현행 단가 11,000)
  'nonBenefitAmount: 포함 label is 진료비, VAT split': {
    exceeded: false,
    unitPrice: 10000,
    vat: 1000,
    inclusiveSupply: 10000,
  },
  // 결정 6: 베드 수는 정수만 받습니다
  'treatmentRoom: fractional bed count passes client check': { canSave: false, duplicate: false },
  // 결정 4: 처음 불러온 100건이 아니라 유니크 제약으로 모든 이름과 비교합니다
  'personalFormulaName: only first 100 loaded names checked': { duplicate: true },
}

describe('현행 픽스처 (settings-validation)', () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
    const run = RUN[input['check']]!
    expect(run.server(input)).toEqual(name in CHANGED ? CHANGED[name] : run.legacy(expected))
  })

  it('모든 픽스처 케이스를 판정에 연결하고 바뀐 기대값은 실제 케이스 이름을 가리킵니다', () => {
    expect(fixture.cases.filter((c) => !(c.input['check'] in RUN)).map((c) => c.name)).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
