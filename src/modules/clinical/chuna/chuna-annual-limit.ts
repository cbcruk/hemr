import type { Coverage } from '../../../shared/coverage.ts'
import type { ServiceAt } from '../fees/consultation-fee-code.ts'

/** 추나 처방 카테고리입니다. */
export const CHUNA_CATEGORY = '33001005'

/** 추나 수가코드(단순·복잡·복잡80·특수)입니다. 산재 진료기록은 이 코드로 추나 줄을 찾습니다. */
const 추나수가코드: ReadonlySet<string> = new Set(['40710', '40720', '40721', '40730'])

/**
 * 보험구분별 추나 한도 초기값입니다. 참조데이터 `regulatory-limits`에 유효기간과 함께 둘 값입니다 (결정 2).
 * 건보·의료급여·산재는 연 단위, 자보는 사고 단위입니다. 표에 없는 보험구분은 검사하지 않습니다.
 */
export const DEFAULT_CHUNA_LIMITS: Readonly<Partial<Record<Coverage, number>>> = {
  NHIS: 20,
  MEDICAL_AID: 20,
  AUTO_INSURANCE: 20,
  INDUSTRIAL_ACCIDENT: 20,
}

/** 심평원 추나 시술 내역의 한 행입니다. 진료일자별 한 행입니다. */
export interface HiraChunaRow {
  /** `YYYY-MM-DD`입니다. */
  serviceDate: string
  deleted: boolean
  /** 우리 기관에서 시행했는지입니다(현행 `해당요양기관등록여부`·`본원여부`). */
  ownClinic: boolean
}

/**
 * 서버에 저장한 심평원 추나 사용량입니다. 에이전트가 조회한 결과로 만들고 `GET /patients/{id}/hira-usage`로 줍니다.
 * 건보·의료급여는 진료 연도, 자보는 사고접수번호 단위로 조회합니다.
 */
export interface HiraChunaUsage {
  rows: readonly HiraChunaRow[]
  /** 심평원이 따로 준 누적 횟수(`getChunaData.조회결과.추나횟수`)입니다. 없으면 `null`이고 행 수로 셉니다. */
  cumulativeCount: number | null
  /** 목록이 페이지 한도에서 잘리지 않았는지입니다. 거짓이면 한도를 판정하지 않습니다 (결정 7). */
  complete: boolean
}

/** 사용량을 화면에 보여 줄 요약입니다. */
export interface ChunaUsageSummary {
  ownCount: number
  otherCount: number
  /** 진료일보다 앞선 날의 시행 수입니다 (결정 1). */
  priorCount: number
  /**
   * 진료일에 삭제되지 않은 시행 이력이 있는지입니다. 기기 오늘이 아니라 진료일 기준입니다 (결정 5). 현재 진료의
   * 제출분도 포함하므로 이미 제출한 진료에서는 참입니다.
   */
  sameDay: boolean
  exhausted: boolean
  availableToday: boolean
}

/** 사용량을 요약할 진료와 그 보험구분의 한도입니다. */
export interface ChunaUsageContext {
  serviceAt: ServiceAt
  limit: number
}

/**
 * 추나 사용량 요약입니다 (결정 1·5·6).
 *
 * 누적은 심평원 누적 횟수가 있으면 그 값(`0` 포함, 결정 6 보류), 없으면 삭제되지 않은 행 수입니다. 이전 시행
 * 수는 누적에서 진료일과 그 뒤 날짜의 행을 뺀 값입니다. 현재 진료의 제출분이 이미 들어갔는지, 과거 진료를 나중에
 * 열었는지와 상관없이 같은 답이 나옵니다. 심평원 누적 횟수는 조회 기간 전체의 값이라 행을 빼는 것으로 맞춥니다.
 */
export function chunaUsageSummary(usage: HiraChunaUsage, context: ChunaUsageContext): ChunaUsageSummary {
  const 삭제안된행 = usage.rows.filter((row) => !row.deleted)
  const 본원추나시행건수 = 삭제안된행.filter((row) => row.ownClinic).length
  const 타원추나시행건수 = 삭제안된행.length - 본원추나시행건수
  const 진료일 = context.serviceAt.date
  const 당일추나시술여부 = 삭제안된행.some((row) => row.serviceDate === 진료일)
  const 진료일부터시행수 = 삭제안된행.filter((row) => row.serviceDate >= 진료일).length
  const 이전시행수 = Math.max(0, (usage.cumulativeCount ?? 삭제안된행.length) - 진료일부터시행수)
  const 추나횟수소진 = 이전시행수 >= context.limit
  return {
    ownCount: 본원추나시행건수,
    otherCount: 타원추나시행건수,
    priorCount: 이전시행수,
    sameDay: 당일추나시술여부,
    exhausted: 추나횟수소진,
    availableToday: !당일추나시술여부 && !추나횟수소진,
  }
}

/** 판정에 쓰는 처방 줄입니다. */
export interface ChunaLine {
  lineId: string
  feeCode: string | null
  category: string
}

/** 추나 줄인지입니다. 카테고리 `33001005`이거나 기본코드(앞 5자리)가 추나 수가코드면 추나입니다. */
export function isChunaLine(line: Omit<ChunaLine, 'lineId'>): boolean {
  return line.category === CHUNA_CATEGORY || (line.feeCode !== null && 추나수가코드.has(line.feeCode.slice(0, 5)))
}

/** 산재 사용량을 셀 같은 환자의 다른 진료입니다. 취소·철회한 진료는 호출하는 쪽이 뺍니다. */
export interface ChunaEncounter {
  encounterId: string
  coverage: Coverage
  serviceAt: ServiceAt | null
  lines: readonly Omit<ChunaLine, 'lineId'>[]
}

/**
 * 산재 이전 시행 수입니다 (결정 2·3). 같은 연도 다른 산재 진료 중 진료일보다 앞선 날에 추나 줄이 있는 진료일
 * 수입니다. 한 진료일에 줄이나 진료가 여럿이어도 한 번입니다. 현재 진료일과 그 뒤 날짜는 세지 않습니다.
 */
export function industrialAccidentPriorDays(
  current: { encounterId: string; serviceAt: ServiceAt },
  others: readonly ChunaEncounter[],
): number {
  const 진료연도 = current.serviceAt.date.slice(0, 4)
  const 시행일 = new Set<string>()
  for (const 진료 of others) {
    if (진료.encounterId === current.encounterId || 진료.coverage !== 'INDUSTRIAL_ACCIDENT') continue
    if (진료.serviceAt === null || 진료.serviceAt.date.slice(0, 4) !== 진료연도) continue
    if (진료.serviceAt.date >= current.serviceAt.date || !진료.lines.some(isChunaLine)) continue
    시행일.add(진료.serviceAt.date)
  }
  return 시행일.size
}

/** 이전 시행 수가 한도에 이른 위반입니다. */
export interface ChunaAnnualLimitViolation {
  code: 'CHUNA_ANNUAL_LIMIT'
  /** 현재 진료의 추나 줄 전부입니다. 서버는 줄을 지우지 않습니다 (결정 8). */
  lineIds: string[]
  priorCount: number
  limit: number
  /** 완료를 막는지입니다. 자보는 사례별 인정이라 막지 않습니다 (결정 4). */
  blocksCompletion: boolean
}

/** 저장된 심평원 사용량이 없거나 잘려 한도를 판정하지 못했다는 경고입니다. 완료를 막지 않습니다 (결정 7). */
export interface ChunaUsageUnknown {
  code: 'CHUNA_USAGE_UNKNOWN'
  lineIds: string[]
  blocksCompletion: false
}

export type ChunaLimitIssue = ChunaAnnualLimitViolation | ChunaUsageUnknown

/** 판정할 현재 진료와 사용량입니다. */
export interface ChunaAnnualLimitInput {
  encounterId: string
  coverage: Coverage
  serviceAt: ServiceAt
  lines: readonly ChunaLine[]
  /** 건보·의료급여·자보의 저장된 심평원 사용량입니다. 조회한 적이 없으면 `null`입니다. */
  hiraUsage: HiraChunaUsage | null
  /** 산재 사용량을 셀 같은 환자의 다른 진료입니다. */
  others: readonly ChunaEncounter[]
  limits?: Readonly<Partial<Record<Coverage, number>>>
}

export interface ChunaAnnualLimitJudgement {
  /** 저장은 늘 통과합니다. 항목마다 `blocksCompletion`으로 완료를 막는지 알립니다. */
  warnings: ChunaLimitIssue[]
  /** 완료해도 되는지입니다. 완료를 막는 위반이 있으면 거짓입니다. */
  accepted: boolean
}

/**
 * 추나 한도 판정입니다 (결정 1·2·3·4·7·8).
 *
 * 1. 추나 줄이 없거나 한도가 없는 보험구분이면 판정하지 않습니다
 * 2. 산재는 우리 진료기록의 이전 시행 일수, 나머지는 저장된 심평원 사용량으로 셉니다. 심평원 사용량이 없거나
 *    잘렸으면 `CHUNA_USAGE_UNKNOWN` 경고만 냅니다
 * 3. `이전 시행 수 ≥ 한도`면 `CHUNA_ANNUAL_LIMIT`입니다. 자보는 경고만 내고, 나머지는 완료를 막습니다
 */
export function judgeChunaAnnualLimit(input: ChunaAnnualLimitInput): ChunaAnnualLimitJudgement {
  const 경고없음: ChunaAnnualLimitJudgement = { warnings: [], accepted: true }
  const 한도 = (input.limits ?? DEFAULT_CHUNA_LIMITS)[input.coverage]
  const 추나줄Ids = input.lines.filter(isChunaLine).map((line) => line.lineId)
  if (한도 === undefined || 추나줄Ids.length === 0) return 경고없음

  let 이전시행수: number
  if (input.coverage === 'INDUSTRIAL_ACCIDENT') {
    이전시행수 = industrialAccidentPriorDays(input, input.others)
  } else if (input.hiraUsage === null || !input.hiraUsage.complete) {
    return { warnings: [{ code: 'CHUNA_USAGE_UNKNOWN', lineIds: 추나줄Ids, blocksCompletion: false }], accepted: true }
  } else {
    이전시행수 = chunaUsageSummary(input.hiraUsage, { ...input, limit: 한도 }).priorCount
  }
  if (이전시행수 < 한도) return 경고없음

  const 완료차단 = input.coverage !== 'AUTO_INSURANCE'
  return {
    warnings: [
      {
        code: 'CHUNA_ANNUAL_LIMIT',
        lineIds: 추나줄Ids,
        priorCount: 이전시행수,
        limit: 한도,
        blocksCompletion: 완료차단,
      },
    ],
    accepted: !완료차단,
  }
}

/** 심평원 누적 횟수 조회 결과입니다. 통신 오류나 예외면 에이전트가 `null`로 넘깁니다. */
export interface HiraChunaCountResponse {
  errorCode?: string
  errorMessage?: string
  count?: string | null
}

/** 심평원 누적 횟수를 읽습니다. 오류·빈 값·숫자가 아닌 값은 `null`이고, 그러면 행 수로 셉니다. */
export function parseHiraChunaCount(response: HiraChunaCountResponse | null): number | null {
  if (response === null || response.errorCode || response.errorMessage) return null
  const text = (response.count ?? '').trim()
  if (text === '') return null
  const 누적횟수 = Number(text)
  return Number.isFinite(누적횟수) ? 누적횟수 : null
}

/** 누적 횟수를 따로 조회하는 보험구분입니다. 자보는 사고 단위 목록만 셉니다. */
export function queriesHiraChunaCount(coverage: Coverage): boolean {
  return coverage === 'NHIS' || coverage === 'MEDICAL_AID'
}

/** 심평원 추나 목록의 원본 행입니다. */
export interface HiraChunaListRow extends HiraChunaRow {
  rowNumber: number
}

/**
 * 환자별 목록과 요양기관별 목록을 합칩니다. 환자별 목록에서는 다른 기관 행만 취해 우리 기관 행이 두 번 세지지
 * 않게 합니다. 진료일 내림차순, 같은 날은 행 번호 오름차순입니다.
 */
export function mergeHiraChunaLists(
  byPatient: readonly HiraChunaListRow[],
  byClinic: readonly HiraChunaListRow[],
): HiraChunaListRow[] {
  const merged = [...byPatient.filter((row) => !row.ownClinic), ...byClinic]
  return merged.sort((a, b) =>
    a.serviceDate === b.serviceDate ? a.rowNumber - b.rowNumber : b.serviceDate.localeCompare(a.serviceDate),
  )
}

/** 심평원 추나 조회 기간입니다. */
export interface HiraChunaQueryWindow {
  /** `YYYY-MM-DD`입니다. */
  from: string
  /** `YYYY-MM-DD`이고 이 날을 포함합니다. */
  to: string
  /** 건보·의료급여의 진료 연도입니다. */
  year?: string
  accidentNumber?: string
}

/**
 * 심평원 추나 조회 기간입니다. 진료 연도 1월 1일부터 오늘(지난 연도면 12월 31일)까지이고, 자보는 사고발생일부터
 * 오늘까지입니다. `today`는 병원 시간대의 오늘입니다.
 */
export function hiraChunaQueryWindow(
  serviceDate: string,
  today: string,
  accident?: { accidentNumber: string; accidentDate: string },
): HiraChunaQueryWindow {
  const 진료연도 = serviceDate.slice(0, 4)
  const 진료기간To = 진료연도 === today.slice(0, 4) ? today : `${진료연도}-12-31`
  if (accident !== undefined) {
    return { from: accident.accidentDate, to: 진료기간To, accidentNumber: accident.accidentNumber }
  }
  return { from: `${진료연도}-01-01`, to: 진료기간To, year: 진료연도 }
}
