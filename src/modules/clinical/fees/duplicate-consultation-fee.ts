import type { Coverage } from '../../../shared/coverage.ts'
import type { ServiceAt } from './consultation-fee-code.ts'
import { CONSULTATION_CATEGORY } from './consultation-fee-code.ts'
import { isConsultationFee } from './fee-kinds.ts'

/** 같은 환자의 진료 하나입니다. */
export interface ConsultationEncounter {
  encounterId: string
  serviceAt: ServiceAt | null
  telemedicine: boolean
  feeCodes: readonly string[]
  /** 수납을 마쳤는지입니다. 진찰료를 빼면 과수납이 생길 수 있음을 알리는 데 씁니다. */
  paid: boolean
}

export interface DuplicateConsultationInput {
  coverage: Coverage
  current: ConsultationEncounter & { serviceAt: ServiceAt }
  /**
   * 같은 환자의 다른 진료입니다. 같은 날이 아닌 진료가 섞여 있어도 됩니다. 취소·철회한 진료는 호출하는 쪽이
   * 뺍니다. 보험구분이 다른 진료(예: 같은 날 자보)도 현행처럼 충돌로 셉니다.
   */
  others: readonly ConsultationEncounter[]
  acknowledge?: readonly 'DUPLICATE_CONSULTATION_FEE'[]
}

export interface DuplicateConsultationFee {
  code: 'DUPLICATE_CONSULTATION_FEE'
  /** 같은 날 진찰료를 가진 다른 진료 전부입니다 (결정 5). */
  conflictingEncounterIds: string[]
  /** 현재 진료와 충돌 진료 중 수납을 마친 진료입니다. 비어 있지 않으면 진찰료를 뺄 때 과수납이 생깁니다. */
  paidEncounterIds: string[]
}

export interface DuplicateConsultationJudgement {
  /** 확인을 받지 않은 위반입니다. 저장은 통과하고 완료는 막습니다. */
  warnings: DuplicateConsultationFee[]
  /** 확인을 받고 넘어간 위반입니다. 이력과 청구 명세서 이슈에 남습니다 (결정 2·4). */
  acknowledged: DuplicateConsultationFee[]
  accepted: boolean
}

/** 진찰료 중복을 검사하는 보험구분입니다. 자보는 auto-insurance-same-day-consultation이 맡습니다. */
const 중복검사보험구분: ReadonlySet<Coverage> = new Set(['NHIS', 'MEDICAL_AID'])

/**
 * 같은 날 진찰료 중복입니다 (결정 1·2·3·5).
 *
 * 건보·의료급여 진료에 진찰료가 있고, 같은 환자의 같은 날 다른 진료도 진찰료를 가지면 위반입니다.
 * 대면·비대면 조합을 가리지 않습니다. 전문과목이 다른 의사의 예외가 있어 `acknowledge`로 넘길 수 있습니다.
 */
export function judgeDuplicateConsultationFee(input: DuplicateConsultationInput): DuplicateConsultationJudgement {
  const { current } = input
  const 위반없음: DuplicateConsultationJudgement = { warnings: [], acknowledged: [], accepted: true }
  if (!중복검사보험구분.has(input.coverage) || !진찰료있음(current)) return 위반없음

  const 충돌진료 = 같은날진찰료진료(current, input.others)
  if (충돌진료.length === 0) return 위반없음

  const 위반: DuplicateConsultationFee = {
    code: 'DUPLICATE_CONSULTATION_FEE',
    conflictingEncounterIds: 충돌진료.map((other) => other.encounterId),
    paidEncounterIds: [current, ...충돌진료]
      .filter((encounter) => encounter.paid)
      .map((encounter) => encounter.encounterId),
  }
  return input.acknowledge?.includes('DUPLICATE_CONSULTATION_FEE') === true
    ? { warnings: [], acknowledged: [위반], accepted: true }
    : { warnings: [위반], acknowledged: [], accepted: false }
}

/** 청구 명세서 이슈를 만들 처방 줄입니다. */
export interface ClaimLine {
  lineId: string
  feeCode: string
  category: string
}

export interface TelemedicineDuplicateIssue {
  code: 'T0004'
  lineIds: string[]
}

/**
 * 비대면 진료의 진찰료 중복 청구 이슈 `T0004`입니다 (결정 4).
 *
 * 비대면 진료이고 같은 날 대면 진료에 진찰료가 있으면, 한방진찰료 카테고리의 진찰료 줄에 붙입니다. 완료할 때
 * 중복을 확인하고 넘긴 진료라 청구 담당자가 명세서 `issues[]`에서 보고 `:suppress`로 끌 수 있습니다.
 * 같은 날 판정은 `judgeDuplicateConsultationFee`와 같은 함수를 씁니다. 비대면 시범사업은 건보·의료급여 진료에만
 * 있으므로 보험구분은 보지 않습니다.
 */
export function telemedicineDuplicateIssues(input: {
  current: ConsultationEncounter & { serviceAt: ServiceAt }
  lines: readonly ClaimLine[]
  others: readonly ConsultationEncounter[]
}): TelemedicineDuplicateIssue[] {
  const 대면진찰료진료 = 같은날진찰료진료(input.current, input.others).filter((other) => !other.telemedicine)
  if (!input.current.telemedicine || 대면진찰료진료.length === 0) return []
  const 진찰료줄ID = input.lines
    .filter((line) => line.category === CONSULTATION_CATEGORY && isConsultationFee(line.feeCode))
    .map((line) => line.lineId)
  return 진찰료줄ID.length > 0 ? [{ code: 'T0004', lineIds: 진찰료줄ID }] : []
}

/** 같은 날 진찰료를 가진 다른 진료입니다. 진료 시각이 없는 진료는 날짜를 몰라 세지 않습니다. */
function 같은날진찰료진료(
  current: ConsultationEncounter & { serviceAt: ServiceAt },
  others: readonly ConsultationEncounter[],
): ConsultationEncounter[] {
  return others.filter(
    (other) =>
      other.encounterId !== current.encounterId &&
      other.serviceAt?.date === current.serviceAt.date &&
      진찰료있음(other),
  )
}

function 진찰료있음(encounter: ConsultationEncounter): boolean {
  return encounter.feeCodes.some(isConsultationFee)
}
