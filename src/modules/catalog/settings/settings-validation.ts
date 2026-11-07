import { decimalFraction, divideHalfUp } from '../../../shared/money/decimal.ts'

/**
 * 설정 저장 검증입니다. 함수마다 위반 목록을 돌려주고, 비어 있으면 저장해도 됩니다. 위반은 Problem Details의
 * `violations[]`(`field`, `code`)에 그대로 담고, 응답 상태와 대표 코드는 `settingProblem`이 정합니다.
 */
export interface SettingViolation {
  field: string
  code: string
}

/** 요청 형식 위반 코드입니다. 400 `VALIDATION_FAILED`가 됩니다 (conventions 오류). */
const 형식위반코드: ReadonlySet<string> = new Set(['REQUIRED', 'INVALID_TYPE', 'INVALID_VALUE'])
const 중복코드 = 'SETTING_NAME_DUPLICATE'

/**
 * 위반 목록의 응답입니다. 형식 위반이 있으면 400 `VALIDATION_FAILED`, 업무 규칙 위반이 있으면 422와 리소스의
 * 대표 코드, 남은 것이 이름 중복뿐이면 409 `SETTING_NAME_DUPLICATE`입니다. 어느 경우든 위반을 모두 담습니다.
 */
export function settingProblem(
  violations: readonly SettingViolation[],
  ruleCode: string,
): { status: 400 | 409 | 422; code: string; violations: SettingViolation[] } | null {
  if (violations.length === 0) return null
  const all = [...violations]
  if (violations.some((each) => 형식위반코드.has(each.code))) {
    return { status: 400, code: 'VALIDATION_FAILED', violations: all }
  }
  if (violations.some((each) => each.code !== 중복코드)) return { status: 422, code: ruleCode, violations: all }
  return { status: 409, code: 중복코드, violations: all }
}

/**
 * 설정 이름의 유니크 키입니다 (결정 4). 앞뒤 공백을 빼고 유니코드 NFC로 맞춥니다. macOS에서 입력한 분해형 한글도
 * 같은 이름으로 봅니다. DB 유니크 제약도 같은 키를 씁니다.
 */
export const settingNameKey = (name: string) => name.trim().normalize('NFC')

/**
 * 이름 중복입니다 (결정 4). 병원 단위로 같은 키의 다른 항목이 있으면 `SETTING_NAME_DUPLICATE`입니다. 수정할
 * 때는 자기 자신을 뺍니다. 빈 이름은 중복이 아니라 필수 위반으로 따로 봅니다. 저장소는 같은 키에 유니크 제약을
 * 걸어, 동시에 저장해도 둘 다 통과하지 않게 합니다.
 */
export function hasNameConflict(
  existing: readonly { id: string; name: string }[],
  name: string,
  selfId: string | null = null,
): boolean {
  const 이름키 = settingNameKey(name)
  return 이름키 !== '' && existing.some((each) => each.id !== selfId && settingNameKey(each.name) === 이름키)
}

const 이름필수위반 = (name: string): SettingViolation[] =>
  settingNameKey(name) === '' ? [{ field: 'name', code: 'REQUIRED' }] : []

/** 소수점 아래 6자리까지의 0 이상 수를 분수로 바꿉니다. 그 밖이면 `null`입니다. */
function exactDecimal(value: number): { numerator: number; denominator: number } | null {
  if (!Number.isFinite(value) || value < 0) return null
  try {
    return decimalFraction(value)
  } catch {
    return null
  }
}

// 임의처방

export const ARBITRARY_FORMULA_LIMITS = { totalUsageG: 50, totalAmount: 3000, herbCount: 15 } as const

export interface ArbitraryFormulaHerb {
  /** 기준용량당 상한금액(원)입니다. */
  upperPrice: number
  usageG: number
  /** 상한금액의 기준용량(g)입니다. */
  specG: number
}

export interface ArbitraryFormulaJudgement {
  /** 십진 고정소수로 더한 총 투약량(g)입니다 (결정 5). */
  totalUsageG: number
  /** 약재별로 반올림한 금액의 합입니다. */
  totalAmount: number
  /** 약재별 금액입니다. 값이 잘못된 약재는 0입니다. */
  herbAmounts: number[]
  /** 422 `ARBITRARY_FORMULA_INVALID`의 위반입니다. 한도 위반은 투약량 → 투약가 → 약재 수 순서입니다. */
  violations: SettingViolation[]
}

const 백만분율 = 1_000_000

/** 약재 금액 `사용량 × 상한금액 ÷ 규격`을 정확한 분수로 계산해 반올림(0.5는 올림)합니다. */
function 약재금액(
  사용량: { numerator: number; denominator: number },
  상한금액: { numerator: number; denominator: number },
  규격: { numerator: number; denominator: number },
): number {
  const numerator = BigInt(사용량.numerator) * BigInt(상한금액.numerator) * BigInt(규격.denominator)
  const denominator = BigInt(사용량.denominator) * BigInt(상한금액.denominator) * BigInt(규격.numerator)
  return Number((2n * numerator + denominator) / (2n * denominator))
}

/**
 * 임의처방(보험 단미엑스 조합) 검증입니다 (결정 5). 약재 금액은 `사용량 × 상한금액 ÷ 규격`을 약재별로
 * 반올림하고 더합니다. 금액과 총 투약량 모두 십진 분수로 계산해 부동소수 오차가 없습니다. 총 투약량 50g, 총
 * 투약가 3,000원, 약재 15종까지 받습니다. 이름이 없거나, 약재가 없거나, 사용량이 0 이하이거나 숫자가 잘못된
 * 약재가 있거나, 총 투약가가 0원이면 저장할 수 없습니다. 값이 잘못된 약재는 합계에서 뺍니다.
 */
export function judgeArbitraryFormula(name: string, herbs: readonly ArbitraryFormulaHerb[]): ArbitraryFormulaJudgement {
  const 약재값위반: SettingViolation[] = []
  let 총투약량백만분율 = 0
  const 약재별금액 = herbs.map((약재, index) => {
    const 사용량 = exactDecimal(약재.usageG)
    const 상한금액 = exactDecimal(약재.upperPrice)
    const 규격 = exactDecimal(약재.specG)
    if (사용량 === null || 사용량.numerator === 0) {
      약재값위반.push({ field: `herbs[${index}].usageG`, code: 'INVALID_VALUE' })
    }
    if (상한금액 === null) 약재값위반.push({ field: `herbs[${index}].upperPrice`, code: 'INVALID_VALUE' })
    if (규격 === null || 규격.numerator === 0) {
      약재값위반.push({ field: `herbs[${index}].specG`, code: 'INVALID_VALUE' })
    }
    if (사용량 === null || 상한금액 === null || 규격 === null || 규격.numerator === 0) return 0
    총투약량백만분율 += 사용량.numerator * (백만분율 / 사용량.denominator)
    return 약재금액(사용량, 상한금액, 규격)
  })
  const 총투약가 = 약재별금액.reduce((sum, amount) => sum + amount, 0)
  const 한도 = ARBITRARY_FORMULA_LIMITS
  const violations: SettingViolation[] = [
    ...이름필수위반(name),
    ...(herbs.length === 0 ? [{ field: 'herbs', code: 'REQUIRED' }] : []),
    ...약재값위반,
    ...(herbs.length > 0 && 총투약가 === 0 ? [{ field: 'herbs', code: 'ZERO_AMOUNT' }] : []),
    ...(총투약량백만분율 > 한도.totalUsageG * 백만분율 ? [{ field: 'herbs', code: 'TOTAL_USAGE_EXCEEDED' }] : []),
    ...(총투약가 > 한도.totalAmount ? [{ field: 'herbs', code: 'TOTAL_AMOUNT_EXCEEDED' }] : []),
    ...(herbs.length > 한도.herbCount ? [{ field: 'herbs', code: 'HERB_COUNT_EXCEEDED' }] : []),
  ]
  return { totalUsageG: 총투약량백만분율 / 백만분율, totalAmount: 총투약가, herbAmounts: 약재별금액, violations }
}

const 한도위반문구: Record<string, string> = {
  TOTAL_USAGE_EXCEEDED: '총 투약량은 50g을 초과할 수 없습니다.',
  TOTAL_AMOUNT_EXCEEDED: '총 투약가가 3,000원을 초과할 수 없습니다.',
  HERB_COUNT_EXCEEDED: '총 약재 수는 15개를 초과할 수 없습니다.',
}

/** 한도 위반 문구입니다. 현행 문구와 순서를 그대로 씁니다. */
export const arbitraryFormulaMessages = (violations: readonly SettingViolation[]) =>
  violations.flatMap((violation) => {
    const 문구 = 한도위반문구[violation.code]
    return 문구 === undefined ? [] : [문구]
  })

// 과세·패키지

/** 비급여 과세 구분입니다 (catalog `taxType`). 현행 `별도`·`포함`은 과세, 그 밖은 면세입니다. */
export type TaxType = 'TAXABLE' | 'TAX_EXEMPT'

/** 패키지 과세 판정입니다. 첫 항목이 패키지 과세 여부를 정하고, 다른 항목이 하나라도 다르면 혼합입니다. */
export function packageTaxMix(items: readonly { taxType: TaxType }[]): { taxable: boolean | null; mixed: boolean } {
  const 첫항목 = items[0]
  if (첫항목 === undefined) return { taxable: null, mixed: false }
  return { taxable: 첫항목.taxType === 'TAXABLE', mixed: items.some((item) => item.taxType !== 첫항목.taxType) }
}

/** 패키지 저장 위반입니다. 혼합이면 422 `PACKAGE_TAX_MIXED`입니다. */
export const packageTaxViolations = (items: readonly { taxType: TaxType }[]): SettingViolation[] =>
  packageTaxMix(items).mixed ? [{ field: 'items', code: 'PACKAGE_TAX_MIXED' }] : []

/** 패키지에 항목을 더할 수 있는지입니다. 빈 패키지는 무엇이든 받습니다. */
export function canAddToPackage(items: readonly { taxType: TaxType }[], candidate: { taxType: TaxType }): boolean {
  return items[0] === undefined || items[0].taxType === candidate.taxType
}

/** 부가세율 10%를 정수 비율로 둡니다. */
const 부가세율역수 = 10

/** 과세 공급가의 부가세입니다. 10%를 반올림(0.5는 올림)합니다. */
export const vatOf = (supplyPrice: number, taxType: TaxType) =>
  taxType === 'TAXABLE' ? divideHalfUp(supplyPrice, 부가세율역수) : 0

/**
 * 패키지 항목 금액입니다 (결정 3). 단가는 공급가이고, 과세면 부가세를 더한 뒤 일투여량·투약일수를 곱합니다.
 * 현행처럼 `포함` 단가에 10%를 다시 더하지 않습니다. 일투여량이 소수여도 십진 분수로 곱해 원 단위로 반올림합니다.
 */
export function packageItemAmount(item: { unitPrice: number; taxType: TaxType; perDay: number; days: number }): {
  tax: number
  amount: number
} {
  const 부가세 = vatOf(item.unitPrice, item.taxType)
  const 일투여량 = decimalFraction(item.perDay)
  const 금액 = divideHalfUp((item.unitPrice + 부가세) * 일투여량.numerator * item.days, 일투여량.denominator)
  return { tax: 부가세, amount: 금액 }
}

// 비급여 항목

export const NONBENEFIT_PRICE_LIMIT = 10_000_000

/** 비급여 금액 입력 방식입니다. 현행 `별도`(공급가 입력)·`포함`(부가세 포함 진료비 입력)·`면세`입니다. */
export type NonbenefitPriceEntry = 'VAT_EXCLUSIVE' | 'VAT_INCLUSIVE' | 'TAX_EXEMPT'

/**
 * 입력한 비급여 금액을 저장 값으로 바꿉니다 (결정 2·3). 입력값이 10,000,000원을 넘으면 자르지 않고 422
 * `NONBENEFIT_PRICE_EXCEEDED`입니다. `포함`으로 입력한 진료비는 공급가 `round(진료비 ÷ 1.1)`로 저장하고 차액을
 * 부가세로 봅니다. 현행 부가세 표시(`xy`)와 같은 값입니다. 0원은 받습니다.
 */
export function nonbenefitPrice(
  entered: number,
  entry: NonbenefitPriceEntry,
): { ok: true; unitPrice: number; taxType: TaxType; vat: number } | { ok: false; violation: SettingViolation } {
  if (!Number.isInteger(entered) || entered < 0) {
    return { ok: false, violation: { field: 'price', code: 'INVALID_VALUE' } }
  }
  if (entered > NONBENEFIT_PRICE_LIMIT) {
    return { ok: false, violation: { field: 'price', code: 'NONBENEFIT_PRICE_EXCEEDED' } }
  }
  if (entry === 'TAX_EXEMPT') return { ok: true, unitPrice: entered, taxType: 'TAX_EXEMPT', vat: 0 }
  if (entry === 'VAT_EXCLUSIVE') {
    return { ok: true, unitPrice: entered, taxType: 'TAXABLE', vat: vatOf(entered, 'TAXABLE') }
  }
  const 공급가 = divideHalfUp(entered * 부가세율역수, 부가세율역수 + 1)
  return { ok: true, unitPrice: 공급가, taxType: 'TAXABLE', vat: entered - 공급가 }
}

/** 비급여 코드입니다. 현행처럼 입력 코드 앞에 늘 `비`를 붙입니다. 저장된 코드는 이미 붙어 있습니다. */
export const nonbenefitCode = (code: string) => `비${code.trim()}`

/**
 * 수 서비스 전용 처방 이름 중 문서에 남은 것입니다. 현행 클라이언트 상수는 27개이고, 전체 목록은 카탈로그
 * 참조데이터로 옮깁니다. 검증 함수는 목록을 반드시 인자로 받습니다.
 */
export const KNOWN_SOO_RESERVED_NAMES: ReadonlySet<string> = new Set(['경옥고', '수이벤트:경옥고'])

/**
 * 비급여 항목 저장 검증입니다 (결정 4). 이름·코드가 비었으면 필수 위반, 수 서비스 전용 이름이면 422
 * `NONBENEFIT_NAME_RESERVED`, 이름이나 코드가 다른 항목과 겹치면 `SETTING_NAME_DUPLICATE`입니다. 기존 코드는
 * `비`가 붙은 저장 값입니다. 수정할 때는 `selfId`로 자기 자신을 뺍니다. 위반을 모두 모읍니다.
 */
export function nonbenefitItemViolations(
  input: { name: string; code: string },
  existing: readonly { id: string; name: string; code: string }[],
  reservedNames: ReadonlySet<string>,
  selfId: string | null = null,
): SettingViolation[] {
  const 이름키 = settingNameKey(input.name)
  const 코드없음 = input.code.trim() === ''
  const 비급여코드 = nonbenefitCode(input.code)
  return [
    ...이름필수위반(input.name),
    ...(코드없음 ? [{ field: 'code', code: 'REQUIRED' }] : []),
    ...(reservedNames.has(이름키) ? [{ field: 'name', code: 'NONBENEFIT_NAME_RESERVED' }] : []),
    ...(hasNameConflict(existing, 이름키, selfId) ? [{ field: 'name', code: 중복코드 }] : []),
    ...(!코드없음 && existing.some((each) => each.id !== selfId && each.code.trim() === 비급여코드)
      ? [{ field: 'code', code: 중복코드 }]
      : []),
  ]
}

// 치료실

export const TREATMENT_ROOM_LIMITS = { rooms: 10, minBeds: 1, maxBeds: 20, nameLength: 20 } as const

/**
 * 치료실 저장 검증입니다 (결정 1·4·6). 이름은 필수이고 앞뒤 공백을 뺀 20자까지(422 `NAME_TOO_LONG`), 베드 수는
 * 1–20 정수(422 `BED_COUNT_OUT_OF_RANGE`)입니다. 같은 이름의 다른 치료실이 있으면 `SETTING_NAME_DUPLICATE`입니다.
 * 422의 대표 코드는 `TREATMENT_ROOM_INVALID`입니다.
 */
export function treatmentRoomViolations(
  room: { id: string | null; name: string; bedCount: number },
  existing: readonly { id: string; name: string }[],
): SettingViolation[] {
  const 한도 = TREATMENT_ROOM_LIMITS
  const 베드수유효 = Number.isInteger(room.bedCount) && room.bedCount >= 한도.minBeds && room.bedCount <= 한도.maxBeds
  return [
    ...이름필수위반(room.name),
    ...(settingNameKey(room.name).length > 한도.nameLength ? [{ field: 'name', code: 'NAME_TOO_LONG' }] : []),
    ...(베드수유효 ? [] : [{ field: 'bedCount', code: 'BED_COUNT_OUT_OF_RANGE' }]),
    ...(hasNameConflict(existing, room.name, room.id) ? [{ field: 'name', code: 중복코드 }] : []),
  ]
}

/** 치료실을 더 만들 수 있는지입니다. 이미 10개면 422 `TREATMENT_ROOM_LIMIT_EXCEEDED`입니다 (결정 1). */
export const canAddTreatmentRoom = (existingRoomCount: number) => existingRoomCount < TREATMENT_ROOM_LIMITS.rooms
