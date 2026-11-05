import { ageOn, daysBetween, weekdayIndex } from '../../../shared/time/calendar.ts'

/** 진찰료 기본코드입니다. `10100` 초진, `10200` 재진입니다. */
export type ConsultationBaseCode = '10100' | '10200'

/** 진료 시각입니다. 병원 시간대(`Asia/Seoul`) 달력 날짜와 `HH:mm`입니다. */
export interface ServiceAt {
  date: string
  time: string
}

/** 진찰료 가산 설정입니다. 현행 `GET /settings/treatments`의 진료설정에 대응합니다. */
export interface ConsultationSettings {
  /** 6세 미만 연령 가산을 붙일지입니다(현행 `연령에따른시술료가산적용여부`). */
  ageSurcharge: boolean
  /** 야간 가산을 붙일지입니다(현행 `야간진료시진찰료가산여부`). 6세 미만 심야 가산은 이 설정과 상관없습니다. */
  nightSurcharge: boolean
  /** 시니어환자제외여부: 65세 이상은 야간 가산을 빼고 계산합니다. */
  excludeSeniorFromNight: boolean
  /** 토요일공휴일시니어환자제외여부: 65세 이상은 토요·공휴 가산을 빼고 계산합니다. */
  excludeSeniorFromSaturdayHoliday: boolean
  /** 주간 시작·끝(`HH:mm`)입니다. 기본 09:00–18:00입니다. */
  daytimeStart: string
  daytimeEnd: string
  /**
   * 초진 산정일수입니다. 이전 진료와 달력 날짜 차이가 이 값 이하면 재진입니다 (결정 4).
   * `null`이면 초진·재진을 자동으로 판정하지 않습니다 (결정 5).
   */
  initialVisitWindowDays: number | null
  /** 초진에 변증기술료를 붙일지입니다(현행 `초진환자처방시변증기술료적용여부`). */
  addPatternDiagnosisFee: boolean
}

export interface ConsultationContext {
  serviceAt: ServiceAt
  /** 생년월일(`YYYY-MM-DD`)입니다. 모르면 `null`이고 연령·시니어 판정을 하지 않습니다. */
  birthDate: string | null
  settings: ConsultationSettings
  /** 그날 적용되는 공휴일입니다. 참조데이터에서 진료일 기준으로 조회합니다 (결정 7). */
  publicHolidays: ReadonlySet<string>
  /** 비대면 진료면 가산을 붙이지 않습니다. */
  telemedicine?: boolean
  /** 진료 화면의 토요 가산 수동 적용입니다. */
  forceSaturday?: boolean
  /** 대리 수령자가 처방전과 약제를 받았는지입니다. */
  proxyReceipt?: boolean
}

/** 처방 줄입니다. */
export interface FeeLine {
  feeCode: string
  category: string
  name?: string
  /** 줄 단위 특정내역입니다. 야간 진찰료는 `JS010`에 진료 시각을 적습니다. */
  lineDetails?: { kind: string; content: string }[]
}

export interface PriorEncounter {
  encounterId: string
  serviceAt: ServiceAt | null
}

/**
 * 자동 삽입 입력입니다. 토요 수동 적용과 대리수령은 진료 화면의 버튼으로만 정하므로 받지 않습니다.
 */
export interface ConsultationLinesInput extends Omit<ConsultationContext, 'forceSaturday' | 'proxyReceipt'> {
  encounterId: string
  currentLines: readonly FeeLine[]
  priorEncounters: readonly PriorEncounter[]
  /** 그 날짜 수가 마스터의 수가코드 → 이름입니다. */
  feeMaster: ReadonlyMap<string, string>
}

export interface ConsultationLines {
  /** 더할 줄입니다. 이미 진찰료가 있거나 자동 판정을 끈 경우 빈 목록입니다. */
  lines: FeeLine[]
  /** 계산한 수가코드가 마스터에 없으면 `FEE_CODE_NOT_IN_MASTER`입니다. 저장은 통과하고 완료는 막습니다 (결정 3). */
  warnings: { code: 'FEE_CODE_NOT_IN_MASTER'; feeCodes: string[] }[]
}

export const CONSULTATION_CATEGORY = '31001001'
export const PATTERN_DIAGNOSIS_FEE = { feeCode: '40400', category: '33001099' } as const

/** 이미 있으면 진찰료를 자동으로 넣지 않는 코드 앞자리입니다. `91000`은 비대면 시범사업 진찰료입니다. */
const CONSULTATION_PREFIXES = ['10100', '10200', '91000']

/** 변증기술료를 붙이는 처방 카테고리입니다. 침술·구술·부항술·추나, 자보 시술·처치, 한방조제료입니다. */
const PATTERN_DIAGNOSIS_CATEGORIES: ReadonlySet<string> = new Set([
  '33001001',
  '33001002',
  '33001003',
  '33001004',
  '33001005',
  '73001001',
  '73002001',
  '34002001',
])

const SENIOR_AGE = 65
const SATURDAY_DAYTIME_END = '13:00'
const LATE_NIGHT_START = '22:00'
const SATURDAY_EARLIEST_START = '09:00'

/** 둘째 자리 값입니다. 하나뿐이라 뒤에 정한 값이 앞의 값을 덮습니다(야간 → 심야 → 공휴 → 대리수령). */
const TIME_DIGIT = { none: '0', night: '1', lateNight: '2', saturday: '3', holiday: '5', proxy: '9' } as const

/** 이관할 때 초진 산정일수 0("설정 안 함")을 옮길 값입니다 (결정 5). */
export const DEFAULT_INITIAL_VISIT_WINDOW_DAYS = 30

/**
 * 현행 `초진진찰료산정기준일`을 이관합니다 (결정 5).
 *
 * 0은 기본값을 그대로 둔 것으로 보고 30으로 옮깁니다. 음수처럼 쓸 수 없는 값도 30으로 옮깁니다.
 * 자동 판정을 끄려면 이관 뒤 병원이 `null`을 고릅니다.
 */
export function migrateInitialVisitWindow(days: number): number {
  return Number.isInteger(days) && days > 0 ? days : DEFAULT_INITIAL_VISIT_WINDOW_DAYS
}

/**
 * 진찰료 수가코드입니다. 가산이 없으면 5자리 기본코드, 있으면 `기본코드 + 연령 + 시간 + 0` 8자리입니다.
 *
 * 토요 가산이면 현행처럼 기본 줄과 토요 줄(둘째 자리 `3`) 두 개를 돌려줍니다 (결정 2, 임시).
 * 65세 이상의 토요·공휴 제외는 그날 야간 가산에 영향을 주지 않습니다 (결정 8).
 */
export function consultationFeeCodes(base: ConsultationBaseCode, context: ConsultationContext): string[] {
  if (context.telemedicine === true) return [base]
  const { settings, serviceAt } = context
  const { date, time } = serviceAt
  // 진료일보다 늦은 생년월일은 잘못된 값이라 나이를 모르는 것으로 봅니다
  const age = context.birthDate === null || context.birthDate > date ? null : ageOn(context.birthDate, date)

  let ageDigit = '0'
  if (settings.ageSurcharge && age !== null) {
    if (age < 1) ageDigit = '1'
    else if (age < 6) ageDigit = '6'
  }

  const senior = age !== null && age >= SENIOR_AGE
  const weekday = weekdayIndex(date)
  const holiday = context.publicHolidays.has(date) || weekday === 0
  const seniorExcluded = settings.excludeSeniorFromSaturdayHoliday && senior
  const saturdayDaytime =
    weekday === 6 && minTime(SATURDAY_EARLIEST_START, settings.daytimeStart) <= time && time <= SATURDAY_DAYTIME_END
  const saturday = (!seniorExcluded && !holiday && saturdayDaytime) || context.forceSaturday === true

  let timeDigit: string = TIME_DIGIT.none
  const dayEnd = weekday === 6 ? SATURDAY_DAYTIME_END : settings.daytimeEnd
  const nightTime = time < settings.daytimeStart || time >= dayEnd
  if (settings.nightSurcharge && !saturday && (!settings.excludeSeniorFromNight || !senior) && nightTime) {
    timeDigit = TIME_DIGIT.night
  }
  if (time >= LATE_NIGHT_START && age !== null && age >= 1 && age < 6 && !saturday) timeDigit = TIME_DIGIT.lateNight
  if (holiday && !saturday && !seniorExcluded) timeDigit = TIME_DIGIT.holiday
  if (context.proxyReceipt === true) timeDigit = TIME_DIGIT.proxy

  const code = composeCode(base, ageDigit, timeDigit)
  return saturday ? [code, composeCode(base, ageDigit, TIME_DIGIT.saturday)] : [code]
}

/**
 * 재진인지입니다 (결정 4).
 *
 * 같은 환자의 다른 진료 중 진료 시각이 현재보다 엄격히 이르고, 달력 날짜 차이가 산정일수 이하인 것이
 * 있으면 재진입니다. 같은 날 앞선 진료도 재진 근거입니다. 같은 시각이나 이후 진료는 세지 않습니다.
 */
export function isFollowUpVisit(
  current: { encounterId: string; serviceAt: ServiceAt },
  priors: readonly PriorEncounter[],
  windowDays: number,
): boolean {
  return priors.some(
    (prior) =>
      prior.encounterId !== current.encounterId &&
      prior.serviceAt !== null &&
      compareServiceAt(prior.serviceAt, current.serviceAt) < 0 &&
      daysBetween(prior.serviceAt.date, current.serviceAt.date) <= windowDays,
  )
}

/**
 * 진료에 자동으로 넣을 진찰료 줄입니다.
 *
 * 1. 이미 진찰료(`10100`·`10200`·`91000`…)가 있거나 자동 판정을 껐으면 넣지 않습니다
 * 2. 초진·재진을 판정하고 가산을 붙인 수가코드를 만듭니다. 야간 코드면 첫 줄에 `JS010` 특정내역을 붙입니다
 * 3. 계산한 코드가 수가 마스터에 없으면 기본코드로 바꾸지 않고 줄 없이 경고합니다 (결정 3)
 * 4. 초진이고 설정이 켜져 있고 시술·조제 줄이 있으면 변증기술료 `40400`을 더합니다. `40400`이 마스터에 없으면
 *    진찰료 줄은 넣고 변증기술료만 빼며 경고합니다
 */
export function consultationLines(input: ConsultationLinesInput): ConsultationLines {
  const windowDays = input.settings.initialVisitWindowDays
  const hasConsultation = input.currentLines.some((line) =>
    CONSULTATION_PREFIXES.some((prefix) => line.feeCode.startsWith(prefix)),
  )
  if (hasConsultation || windowDays === null) return { lines: [], warnings: [] }

  const followUp = isFollowUpVisit(input, input.priorEncounters, windowDays)
  const codes = consultationFeeCodes(followUp ? '10200' : '10100', input)
  const missing = codes.filter((code) => !input.feeMaster.has(code))
  if (missing.length > 0) return { lines: [], warnings: [{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: missing }] }

  const lines: FeeLine[] = codes.map((feeCode, index) => {
    const line: FeeLine = { feeCode, category: CONSULTATION_CATEGORY, name: input.feeMaster.get(feeCode)! }
    if (index === 0 && decodeFeeCode(feeCode).night) {
      line.lineDetails = [{ kind: 'JS010', content: claimTimestamp(input.serviceAt) }]
    }
    return line
  })

  const needsPatternDiagnosis =
    !followUp &&
    input.settings.addPatternDiagnosisFee &&
    !input.currentLines.some((line) => line.feeCode === PATTERN_DIAGNOSIS_FEE.feeCode) &&
    input.currentLines.some((line) => PATTERN_DIAGNOSIS_CATEGORIES.has(line.category))
  if (!needsPatternDiagnosis) return { lines, warnings: [] }
  const name = input.feeMaster.get(PATTERN_DIAGNOSIS_FEE.feeCode)
  if (name === undefined) {
    return { lines, warnings: [{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: [PATTERN_DIAGNOSIS_FEE.feeCode] }] }
  }
  lines.push({ ...PATTERN_DIAGNOSIS_FEE, name })
  return { lines, warnings: [] }
}

export interface DecodedFeeCode {
  baseCode: string
  initialVisit: boolean
  followUpVisit: boolean
  night: boolean
  lateNight: boolean
  saturday: boolean
  holiday: boolean
  underOne: boolean
  oneToSix: boolean
  proxyReceipt: boolean
}

/**
 * 수가코드를 `앞 5자리 / 연령 / 시간 / 끝자리`로 풉니다.
 *
 * 야간 `1`과 공휴 `5`는 진찰료(`10…`)와 시술(`40…`)에서만, 심야 `2`·토요 `3`·대리수령 `9`는 진찰료에서만
 * 뜻이 있습니다. 연령 자리는 진찰료에서만 풉니다.
 */
export function decodeFeeCode(code: string): DecodedFeeCode {
  const baseCode = code.slice(0, 5)
  const ageDigit = code[5] ?? '0'
  const timeDigit = code[6] ?? '0'
  const consultation = baseCode.startsWith('10')
  const surchargeable = consultation || baseCode.startsWith('40')
  return {
    baseCode,
    initialVisit: baseCode === '10100',
    followUpVisit: baseCode === '10200',
    night: surchargeable && timeDigit === TIME_DIGIT.night,
    lateNight: consultation && timeDigit === TIME_DIGIT.lateNight,
    saturday: consultation && timeDigit === TIME_DIGIT.saturday,
    holiday: surchargeable && timeDigit === TIME_DIGIT.holiday,
    underOne: consultation && ageDigit === '1',
    oneToSix: consultation && ageDigit === '6',
    proxyReceipt: consultation && timeDigit === TIME_DIGIT.proxy,
  }
}

function composeCode(base: string, ageDigit: string, timeDigit: string): string {
  return ageDigit === '0' && timeDigit === TIME_DIGIT.none ? base : `${base}${ageDigit}${timeDigit}0`
}

function compareServiceAt(left: ServiceAt, right: ServiceAt): number {
  const a = `${left.date} ${left.time}`
  const b = `${right.date} ${right.time}`
  return a < b ? -1 : a > b ? 1 : 0
}

/** 청구 특정내역에 쓰는 `yyyyMMddHHmm`입니다. */
export function claimTimestamp(serviceAt: ServiceAt): string {
  return serviceAt.date.replaceAll('-', '') + serviceAt.time.replace(':', '')
}

function minTime(left: string, right: string): string {
  return left < right ? left : right
}
