import { clinicDate, clinicTime } from '../../../shared/time/clinic-date.ts'
import type { ServiceAt } from '../fees/consultation-fee-code.ts'
import { judgeDuplicateConsultationFee } from '../fees/duplicate-consultation-fee.ts'
import type { ConsultationEncounter } from '../fees/duplicate-consultation-fee.ts'
import { pilotHerbalApprovalViolation } from '../pilot-herbal/pilot-herbal-approval.ts'
import { coverageMismatches } from '../prescriptions/prescription-line-changes.ts'
import type { CompletionViolation, Encounter } from './encounter.ts'

/** 완료할 때 확인하고 넘길 수 있는 위반입니다. */
export type Acknowledgeable = 'DUPLICATE_CONSULTATION_FEE'

export interface CompletionInput {
  encounter: Encounter
  /** 같은 환자의 다른 진료입니다. 완료하지 않았거나 철회한 진료는 이 함수가 뺍니다. */
  others: ReadonlyArray<Encounter>
  acknowledge: ReadonlyArray<Acknowledgeable>
}

export interface CompletionJudgement {
  /** 완료를 막는 위반입니다. 검사 순서대로입니다. */
  violations: CompletionViolation[]
  /** 확인을 받고 넘긴 위반의 코드입니다. `encounter.completed` 이벤트에 남깁니다. */
  acknowledged: Acknowledgeable[]
}

/**
 * 진료 완료 검증입니다 (clinical.md 완료 검증 규칙). 지금 가진 데이터로 판정할 수 있는 규칙만 봅니다. 순서는 주상병,
 * 보험구분 전용 처방, 첩약 시범사업 승인, 같은 날 진찰료 중복입니다.
 *
 * - 주상병은 정확히 하나여야 합니다. 저장의 경고와 달리 상병이 없어도 위반입니다
 * - 첩약 시범사업 라인은 아직 심평원 승인 상태가 없어 늘 승인 전입니다
 * - 진찰료 중복은 완료(`COMPLETED`·`AMENDED`)한 같은 날 진료와 비교하고, `acknowledge`로 넘길 수 있습니다
 */
export function judgeCompletion(input: CompletionInput): CompletionJudgement {
  const { encounter } = input
  const violations: CompletionViolation[] = []

  const primaries = encounter.diagnoses.filter((each) => each.kind === 'PRIMARY').length
  if (primaries === 0) violations.push({ code: 'PRIMARY_DIAGNOSIS_MISSING', message: 'Choose one primary diagnosis.' })
  if (primaries > 1) {
    violations.push({ code: 'PRIMARY_DIAGNOSIS_MULTIPLE', message: 'Only one primary diagnosis is allowed.' })
  }

  const mismatched = coverageMismatches(encounter.prescriptionLines, {
    coverage: encounter.coverage,
    herbalPilot: false,
    telemedicinePilot: false,
  })
  if (mismatched.length > 0) {
    violations.push({
      code: 'COVERAGE_CATEGORY_MISMATCH',
      message: 'Some prescription lines cannot be used with the coverage of the encounter.',
      targets: mismatched,
    })
  }

  const pilotHerbal = pilotHerbalApprovalViolation(
    encounter.prescriptionLines.map((each) => ({ lineId: each.id, category: each.categoryCode, hiraApproval: null })),
  )
  if (pilotHerbal !== null) {
    violations.push({
      code: 'PILOT_HERBAL_NOT_APPROVED',
      message: 'Pilot herbal prescriptions need HIRA approval before completion.',
      targets: pilotHerbal.lineIds,
    })
  }

  const duplicate = judgeDuplicateConsultationFee({
    coverage: encounter.coverage,
    current: { ...consultation(encounter), serviceAt: serviceAtOf(encounter.serviceAt) },
    others: input.others
      .filter((each) => each.id !== encounter.id && (each.status === 'COMPLETED' || each.status === 'AMENDED'))
      .map(consultation),
    acknowledge: input.acknowledge,
  })
  for (const each of duplicate.warnings) {
    violations.push({
      code: each.code,
      message: 'Another encounter on the same day already has a consultation fee.',
      targets: each.conflictingEncounterIds,
    })
  }

  return { violations, acknowledged: duplicate.acknowledged.map((each) => each.code) }
}

/** 진찰료 규칙의 진료입니다. 수납이 아직 없어 모두 수납 전입니다. */
function consultation(encounter: Encounter): ConsultationEncounter {
  return {
    encounterId: encounter.id,
    serviceAt: serviceAtOf(encounter.serviceAt),
    telemedicine: encounter.encounterType === 'TELEMEDICINE',
    feeCodes: encounter.prescriptionLines.flatMap((each) => (each.feeCode === null ? [] : [each.feeCode])),
    paid: false,
  }
}

/** 진료 기준 시각(RFC 3339)의 병원 시간대 날짜와 시각입니다. */
function serviceAtOf(serviceAt: string): ServiceAt {
  const millis = Date.parse(serviceAt)
  return { date: clinicDate(millis), time: clinicTime(millis) }
}
