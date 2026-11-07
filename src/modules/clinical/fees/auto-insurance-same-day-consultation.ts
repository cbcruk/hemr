import type { Coverage } from '../../../shared/coverage.ts'
import type { ServiceAt } from './consultation-fee-code.ts'
import type { DuplicateConsultationFee, DuplicateConsultationJudgement } from './duplicate-consultation-fee.ts'
import { isConsultationFee } from './fee-kinds.ts'

/** 같은 환자의 진료 하나입니다. 자보 1일 2차 판정에 필요한 값만 담습니다. */
export interface AutoInsuranceEncounter {
  encounterId: string
  coverage: Coverage
  serviceAt: ServiceAt | null
  /** 생성 시각(ISO 8601)입니다. 진료 시각이 같을 때 앞뒤를 정합니다 (결정 3). */
  createdAt?: string
  /** 자보 사고접수번호입니다. 없으면 `null`입니다. */
  accidentNumber: string | null
  /** 자보 1일 2차 지정입니다. `null`은 한 번도 정하지 않은 것이고, 사용자가 해제하면 `false`입니다. */
  secondVisit: boolean | null
  lines: readonly { lineId: string; feeCode: string }[]
  paid: boolean
}

export interface AutoInsuranceSameDayInput {
  current: AutoInsuranceEncounter & { serviceAt: ServiceAt }
  /** 같은 환자의 다른 진료입니다. 같은 날 자보 진료만 씁니다. 취소·철회한 진료는 호출하는 쪽이 뺍니다. */
  others: readonly AutoInsuranceEncounter[]
}

/** 2차 자동 지정 하나입니다. 저장 서비스가 이 값으로 `AUTO_INSURANCE_SECOND_VISIT_ASSIGNED` warning 상세를 만듭니다. */
export interface SecondVisitDesignation {
  encounterId: string
  /** 2차로 지정하면서 지울 진찰료 줄입니다 (결정 5). */
  removedLineIds: string[]
}

export interface AutoInsuranceSecondVisits {
  /** 그날 다른 사고의 자보 진료가 함께 있는지입니다(사고접수번호 2종 이상). 아니면 2차 판정을 하지 않습니다. */
  multipleAccidents: boolean
  /**
   * 2차로 지정되지 않은 가장 이른 진료입니다 (결정 2). 현행 `후보` 판정처럼 같은 사고나 사고접수번호가 없는
   * 진료도 후보입니다. 모두 2차면 `null`입니다.
   */
  primaryEncounterId: string | null
  /** 현재 진료가 2차 진료인지입니다. 진료 화면의 2차 안내 배너가 이 값을 씁니다. */
  currentIsSecondVisit: boolean
  /** 서버가 저장할 때 2차로 자동 지정할 진료입니다. 지정이 `null`인 진료만 들어갑니다 (결정 4·6). */
  designations: SecondVisitDesignation[]
}

export interface AutoInsuranceClaimIssue {
  code: 'J0014'
  lineIds: string[]
}

/**
 * 자보 1일 2차 판정입니다 (결정 2·4·6).
 *
 * 그날 같은 환자의 자보 진료(현재 포함)에 사고접수번호가 2종 이상이면, 2차로 지정되지 않은 가장 이른 진료가
 * 1차이고 나머지는 2차입니다. 2차인데 지정이 `null`인 진료는 서버가 저장할 때 2차로 지정하고 진찰료 줄을
 * 지운 뒤 `AUTO_INSURANCE_SECOND_VISIT_ASSIGNED` warning을 줍니다. 사용자가 해제한(`false`) 진료는 그대로 둡니다.
 */
export function autoInsuranceSecondVisits(input: AutoInsuranceSameDayInput): AutoInsuranceSecondVisits {
  const 그날자보진료 = 같은날자보진료(input)
  const 사고접수번호종류 = new Set(그날자보진료.flatMap((encounter) => encounter.accidentNumber ?? []))
  if (input.current.coverage !== 'AUTO_INSURANCE' || 사고접수번호종류.size < 2) {
    return { multipleAccidents: false, primaryEncounterId: null, currentIsSecondVisit: false, designations: [] }
  }
  const 자보1차진료 = 그날자보진료.find((encounter) => encounter.secondVisit !== true) ?? null
  const 자보2차진료임 = (encounter: AutoInsuranceEncounter) => encounter !== 자보1차진료
  return {
    multipleAccidents: true,
    primaryEncounterId: 자보1차진료?.encounterId ?? null,
    currentIsSecondVisit: 자보2차진료임(input.current),
    designations: 그날자보진료
      .filter((encounter) => 자보2차진료임(encounter) && encounter.secondVisit === null)
      .map((encounter) => ({ encounterId: encounter.encounterId, removedLineIds: 진찰료줄ID(encounter) })),
  }
}

/**
 * 청구 경고 `J0014`입니다 (결정 2·5).
 *
 * 2차 진료(2차로 지정됐거나 1차가 아닌 진료)에 진찰료 줄이 남아 있으면 그 줄에 붙입니다. 진찰료는 수가
 * 참조데이터의 진찰료 속성(초기값 `10` 대역)으로 판정합니다.
 */
export function autoInsuranceClaimIssues(input: AutoInsuranceSameDayInput): AutoInsuranceClaimIssue[] {
  if (!autoInsuranceSecondVisits(input).currentIsSecondVisit) return []
  const 남은진찰료줄ID = 진찰료줄ID(input.current)
  return 남은진찰료줄ID.length > 0 ? [{ code: 'J0014', lineIds: 남은진찰료줄ID }] : []
}

/**
 * 같은 사고로 같은 날 진찰료가 2건 이상인지입니다 (결정 1).
 *
 * 현재 진료보다 앞선 같은 사고의 자보 진료에 진찰료가 있으면 뒤 진료인 현재 진료에 `DUPLICATE_CONSULTATION_FEE`
 * warning을 줍니다. 진찰료를 자동으로 지우지 않고 `acknowledge`로 넘길 수 있습니다.
 */
export function judgeSameAccidentDuplicate(
  input: AutoInsuranceSameDayInput & { acknowledge?: readonly 'DUPLICATE_CONSULTATION_FEE'[] },
): DuplicateConsultationJudgement {
  const { current } = input
  const 위반없음: DuplicateConsultationJudgement = { warnings: [], acknowledged: [], accepted: true }
  if (current.coverage !== 'AUTO_INSURANCE' || current.accidentNumber === null) return 위반없음
  if (진찰료줄ID(current).length === 0) return 위반없음

  const 충돌진료 = 같은날자보진료(input).filter(
    (encounter) =>
      encounter !== current &&
      encounter.accidentNumber === current.accidentNumber &&
      진료순서비교(encounter, current) < 0 &&
      진찰료줄ID(encounter).length > 0,
  )
  if (충돌진료.length === 0) return 위반없음

  const 위반: DuplicateConsultationFee = {
    code: 'DUPLICATE_CONSULTATION_FEE',
    conflictingEncounterIds: 충돌진료.map((encounter) => encounter.encounterId),
    paidEncounterIds: [current, ...충돌진료]
      .filter((encounter) => encounter.paid)
      .map((encounter) => encounter.encounterId),
  }
  return input.acknowledge?.includes('DUPLICATE_CONSULTATION_FEE') === true
    ? { warnings: [], acknowledged: [위반], accepted: true }
    : { warnings: [위반], acknowledged: [], accepted: false }
}

/** 청구 명세서 특정내역입니다. 자보 2차로 지정된 진료는 `MT001`에 `U`를 적습니다. */
export function autoInsuranceClaimSpecifics(
  coverage: Coverage,
  secondVisit: boolean | null,
): { kind: string; content: string }[] {
  return coverage === 'AUTO_INSURANCE' && secondVisit === true ? [{ kind: 'MT001', content: 'U' }] : []
}

/** 현재 진료와 같은 날의 자보 진료를 진료 순서대로 돌려줍니다. 현재 진료도 들어갑니다. */
function 같은날자보진료(input: AutoInsuranceSameDayInput): AutoInsuranceEncounter[] {
  const { current } = input
  const 다른자보진료 = input.others.filter(
    (other) =>
      other.encounterId !== current.encounterId &&
      other.coverage === 'AUTO_INSURANCE' &&
      other.serviceAt?.date === current.serviceAt.date,
  )
  return [current, ...다른자보진료].sort(진료순서비교)
}

/**
 * 진료 시각, 생성 시각, ID 순으로 비교합니다 (결정 3). 생성 시각이 없는 진료(이관 데이터)는 있는 진료보다 앞에
 * 둡니다. 세 값을 한 줄로 이어 비교하므로 순서가 전순서가 되어, 정렬 결과가 입력 순서에 따라 달라지지 않습니다.
 */
function 진료순서비교(left: AutoInsuranceEncounter, right: AutoInsuranceEncounter): number {
  const a = 진료순서키(left)
  const b = 진료순서키(right)
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index]! < b[index]! ? -1 : 1
  }
  return 0
}

function 진료순서키(encounter: AutoInsuranceEncounter): string[] {
  const { serviceAt, createdAt } = encounter
  return [
    serviceAt === null ? '' : `${serviceAt.date} ${serviceAt.time}`,
    createdAt === undefined ? '0' : `1${createdAt}`,
    encounter.encounterId,
  ]
}

function 진찰료줄ID(encounter: AutoInsuranceEncounter): string[] {
  return encounter.lines.filter((line) => isConsultationFee(line.feeCode)).map((line) => line.lineId)
}
