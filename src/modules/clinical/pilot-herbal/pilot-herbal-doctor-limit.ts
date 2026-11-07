import type { ServiceAt } from '../fees/consultation-fee-code.ts'
import type { PilotHerbalDiagnosisIssue, PilotHerbalDiagnosisJudgement } from './pilot-herbal-diagnosis-limit.ts'

/**
 * 의사 한 명의 하루·월·연 첩약 시범사업 처방 건수입니다. 판정(`exceededPilotHerbalDoctorPeriod`)에는 현재 진료를
 * 포함한 순번(`pilotHerbalDoctorCounts`)을, 남은 건수와 집계 엔드포인트에는 이미 쓴 건수(`pilotHerbalDoctorUsage`)를
 * 넣습니다. 저장 전 미리보기는 쓴 건수에 1을 더해 판정해야 서버 판정과 같습니다.
 */
export interface PilotHerbalDoctorCounts {
  day: number
  month: number
  year: number
}

/** 의사별 처방 한도입니다. 이 값까지는 한도 이내이고 넘으면 초과입니다. `regulatory-limits` 참조데이터로 옮길 값입니다. */
export const DEFAULT_PILOT_HERBAL_DOCTOR_LIMITS: PilotHerbalDoctorCounts = { day: 8, month: 60, year: 600 }

export type PilotHerbalDoctorPeriod = 'DAY' | 'MONTH' | 'YEAR'

const 구간키 = { DAY: 'day', MONTH: 'month', YEAR: 'year' } as const
/** 초과를 알릴 때 보는 순서입니다. 일 → 월 → 연입니다. */
const 구간알림순서: readonly PilotHerbalDoctorPeriod[] = ['DAY', 'MONTH', 'YEAR']

/**
 * 같은 의사의 첩약 시범사업 처방이 있는 진료입니다. 호출하는 쪽이 진료 연도(병원 시간대)의 취소되지 않은 진료를
 * 조회합니다. 완료 전 진료와 승인 전 줄이 있는 진료도 넣습니다.
 */
export interface PilotHerbalDoctorEncounter {
  encounterId: string
  serviceAt: ServiceAt
  /** 그 진료에 정한 본인부담률 코드입니다. 일부부담 `G`만 셉니다 (결정 2). */
  copayCode: 'G' | 'U' | null
}

/**
 * 현재 진료의 하루·월·연 순번입니다 (결정 1·2·4). 같은 의사의 일부부담(`G`) 처방 중 현재 진료보다 앞선 건 수에
 * 현재 진료 1건을 더합니다. 순서는 `serviceAt`이고, 시각이 같으면 진료 ID 순입니다. 구간은 `serviceAt`의
 * 병원 시간대 달력 날짜·월·연입니다.
 */
export function pilotHerbalDoctorCounts(
  current: Pick<PilotHerbalDoctorEncounter, 'encounterId' | 'serviceAt'>,
  encounters: readonly PilotHerbalDoctorEncounter[],
): PilotHerbalDoctorCounts {
  const 앞선진료 = encounters.filter((진료) => 진료.encounterId !== current.encounterId && precedes(진료, current))
  const 쓴건수 = pilotHerbalDoctorUsage(current.serviceAt.date, 앞선진료)
  return { day: 쓴건수.day + 1, month: 쓴건수.month + 1, year: 쓴건수.year + 1 }
}

/**
 * 날짜(`YYYY-MM-DD`)가 속한 하루·월·연에 의사가 이미 쓴 일부부담(`G`) 처방 건수입니다. 집계 엔드포인트
 * `GET /doctors/{id}/pilot-herbal-counts?date=`가 돌려주는 값이고, 현재 진료는 들어 있지 않습니다.
 */
export function pilotHerbalDoctorUsage(
  date: string,
  encounters: readonly PilotHerbalDoctorEncounter[],
): PilotHerbalDoctorCounts {
  const 일부부담진료 = encounters.filter((진료) => 진료.copayCode === 'G')
  const 같은구간건수 = (length: number) =>
    일부부담진료.filter((진료) => 진료.serviceAt.date.slice(0, length) === date.slice(0, length)).length
  return { day: 같은구간건수(10), month: 같은구간건수(7), year: 같은구간건수(4) }
}

type Ordered = Pick<PilotHerbalDoctorEncounter, 'encounterId' | 'serviceAt'>
const sortKey = (encounter: Ordered) => `${encounter.serviceAt.date}T${encounter.serviceAt.time}`

function precedes(a: Ordered, b: Ordered): boolean {
  const [left, right] = [sortKey(a), sortKey(b)]
  return left < right || (left === right && a.encounterId < b.encounterId)
}

/** 한도를 넘은 구간 중 먼저 알릴 구간입니다. 넘지 않았으면 `null`입니다. */
export function exceededPilotHerbalDoctorPeriod(
  counts: PilotHerbalDoctorCounts,
  limits: PilotHerbalDoctorCounts = DEFAULT_PILOT_HERBAL_DOCTOR_LIMITS,
): PilotHerbalDoctorPeriod | null {
  return 구간알림순서.find((구간) => counts[구간키[구간]] > limits[구간키[구간]]) ?? null
}

/** 이미 쓴 건수(`pilotHerbalDoctorUsage`)로 본 남은 처방 가능 건수입니다. 현행처럼 넘으면 음수가 그대로 나옵니다. */
export function remainingPilotHerbalDoctorQuota(
  counts: PilotHerbalDoctorCounts,
  limits: PilotHerbalDoctorCounts = DEFAULT_PILOT_HERBAL_DOCTOR_LIMITS,
): PilotHerbalDoctorCounts {
  return { day: limits.day - counts.day, month: limits.month - counts.month, year: limits.year - counts.year }
}

/** 의사별 한도 초과 경고입니다. 본인부담률 코드를 `U`로 바꾸고 진료는 막지 않습니다 (결정 5). */
export interface PilotHerbalDoctorLimitWarning {
  code: 'PILOT_HERBAL_DOCTOR_LIMIT'
  period: PilotHerbalDoctorPeriod
  count: number
  limit: number
  lineIds: string[]
  blocksCompletion: false
}

/** 질환 이력 판정에 의사별 한도까지 더한 본인부담률 판정입니다. */
export interface PilotHerbalCopayJudgement extends Omit<PilotHerbalDiagnosisJudgement, 'warnings'> {
  warnings: (PilotHerbalDiagnosisIssue | PilotHerbalDoctorLimitWarning)[]
}

export interface PilotHerbalDoctorLimitInput {
  counts: PilotHerbalDoctorCounts
  limits?: PilotHerbalDoctorCounts
}

/**
 * 질환 이력 판정에 의사별 한도를 더합니다 (결정 5). 한도를 넘으면 이력과 상관없이 본인부담률 코드를 `U`로 정하고
 * 전액부담 선택지를 없앱니다. 사용자가 `G`를 보내도 `U`로 저장합니다. 완료 여부(`accepted`)는 질환 이력 판정이
 * 정한 대로 둡니다. `lineIds`는 호출하는 쪽이 질환 이력 판정에 넘긴 첩약 줄을 그대로 넘깁니다.
 */
export function applyPilotHerbalDoctorLimit(
  judgement: PilotHerbalDiagnosisJudgement,
  lineIds: readonly string[],
  input: PilotHerbalDoctorLimitInput,
): PilotHerbalCopayJudgement {
  const 한도 = input.limits ?? DEFAULT_PILOT_HERBAL_DOCTOR_LIMITS
  const 초과구간 = exceededPilotHerbalDoctorPeriod(input.counts, 한도)
  if (초과구간 === null) return judgement
  const key = 구간키[초과구간]
  const 경고: PilotHerbalDoctorLimitWarning = {
    code: 'PILOT_HERBAL_DOCTOR_LIMIT',
    period: 초과구간,
    count: input.counts[key],
    limit: 한도[key],
    lineIds: [...lineIds],
    blocksCompletion: false,
  }
  return { ...judgement, copayCode: 'U', fullPayOptional: false, warnings: [...judgement.warnings, 경고] }
}

const 구간문구 = { DAY: '오늘', MONTH: '이번달', YEAR: '올해' } as const

/** 경고 문구입니다. 현행 문구를 그대로 씁니다. */
export function pilotHerbalDoctorLimitMessage(warning: Pick<PilotHerbalDoctorLimitWarning, 'period'>): string {
  return `${구간문구[warning.period]} 원장님의 처방 가능 횟수가 초과됐습니다.`
}
