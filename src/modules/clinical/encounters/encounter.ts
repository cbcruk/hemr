import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'
import { TenantId, UserId } from '../../identity/identity.ts'
import { PatientId } from '../../patients/patient.ts'
import { BenefitFlags, Coverage, VisitId } from '../../front-desk/visits/visit.ts'
import { EncounterId } from './encounter-id.ts'

export { EncounterId }

/** 상병 ID입니다. 예: `dx_01J...` */
export const DiagnosisId = Schema.String.pipe(
  Schema.refine((value): value is Id<'diagnosis'> => isId('diagnosis', value)),
)

/**
 * KCD 상병코드입니다. 영문 대문자 하나, 숫자 둘, 그 뒤 `.`과 세부 분류 1–3자입니다. 예: `U23.4`, `M54.56`
 *
 * 마스터에 있는 코드인지는 참조데이터(`/reference/diagnoses-kcd`)가 생길 때 확인합니다.
 */
export const DiagnosisCode = Schema.String.check(Schema.isPattern(/^[A-Z]\d{2}(\.[0-9A-Z]{1,3})?$/))

/** 주상병(`PRIMARY`)과 부상병(`SECONDARY`)입니다. */
export const DiagnosisKind = Schema.Literals(['PRIMARY', 'SECONDARY'])

export const Diagnosis = Schema.Struct({
  id: DiagnosisId,
  code: DiagnosisCode,
  kind: DiagnosisKind,
})
export type Diagnosis = typeof Diagnosis.Type

/** 진료기록 본문입니다. 편집기가 만든 HTML을 그대로 둡니다. */
export const ClinicalNote = Schema.Struct({ body: Schema.String })
export type ClinicalNote = typeof ClinicalNote.Type

/** 진료가 있는 단계입니다 (clinical.md 진료 상태도). 지금은 초안 저장만 있어 `DRAFT`만 만들어집니다. */
export const EncounterStatus = Schema.Literals(['DRAFT', 'COMPLETED', 'AMENDED', 'ENTERED_IN_ERROR'])

/** 진료 방식입니다. 지금은 내원 접수로 만드는 `OFFICE`만 있습니다. */
export const EncounterType = Schema.Literals(['OFFICE', 'HOME_VISIT', 'TELEMEDICINE'])

/**
 * 진료입니다. 내원 하나에 하나 생깁니다.
 *
 * 지금은 초안 저장에 필요한 필드만 두었습니다. 처방 라인·활력징후·서명·고정·`allowedActions`는 그 기능이 생길 때
 * 더합니다. 전체 리소스는 `docs/design/clinical.md`를 보세요.
 */
export const Encounter = Schema.Struct({
  id: EncounterId,
  tenantId: TenantId,
  patientId: PatientId,
  /** 진료를 만든 내원입니다. 방문진료처럼 내원 없는 진료는 `null`입니다. */
  visitId: Schema.NullOr(VisitId),
  /** 진료한 한의사입니다. 접수 때는 모르므로 비어 있고, 처음 기록을 저장한 사용자로 채웁니다. */
  doctorId: Schema.NullOr(UserId),
  encounterType: EncounterType,
  /** 내원에서 복사한 보험구분입니다. */
  coverage: Coverage,
  /** 진료 기준 시각입니다(현행 기준일시). 참조데이터·수가는 이 시각으로 고릅니다. 내원 진료는 접수 시각입니다. */
  serviceAt: Schema.String,
  note: ClinicalNote,
  /** 저장한 순서입니다. */
  diagnoses: Schema.Array(Diagnosis),
  /** 내원에서 복사한 표시입니다. */
  benefitFlags: BenefitFlags,
  status: EncounterStatus,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  /** 낙관적 잠금 버전입니다. 응답의 `ETag`로 주고 `If-Match`로 받습니다. */
  version: Schema.Int,
})
export type Encounter = typeof Encounter.Type

/** 저장은 통과했지만 완료 전에 고쳐야 하는 것입니다. */
export const EncounterWarning = Schema.Struct({
  code: Schema.Literals(['PRIMARY_DIAGNOSIS_MISSING', 'PRIMARY_DIAGNOSIS_MULTIPLE']),
  message: Schema.String,
})
export type EncounterWarning = typeof EncounterWarning.Type

/** 요청한 ID의 진료가 없습니다. */
export class EncounterNotFound extends HttpApiError.Problem<EncounterNotFound>()(
  'EncounterNotFound',
  { type: problemType('ENCOUNTER_NOT_FOUND'), status: 404, title: 'Encounter not found' },
  { code: Schema.tag('ENCOUNTER_NOT_FOUND') },
) {}

/** 초안(`DRAFT`)이 아닌 진료를 `PATCH`로 고치려 했습니다. 완료된 진료는 정정(`:amend`)으로 고칩니다. */
export class EncounterNotEditable extends HttpApiError.Problem<EncounterNotEditable>()(
  'EncounterNotEditable',
  { type: problemType('ENCOUNTER_NOT_EDITABLE'), status: 409, title: 'Encounter is not a draft' },
  { code: Schema.tag('ENCOUNTER_NOT_EDITABLE'), currentStatus: EncounterStatus },
) {}

/** 취소한 내원의 진료입니다. 내원을 다시 열거나, 철회(`:retract`)가 생기면 철회합니다. */
export class EncounterVisitCanceled extends HttpApiError.Problem<EncounterVisitCanceled>()(
  'EncounterVisitCanceled',
  { type: problemType('ENCOUNTER_VISIT_CANCELED'), status: 409, title: 'Visit of the encounter is canceled' },
  { code: Schema.tag('ENCOUNTER_VISIT_CANCELED') },
) {}

/** 변경을 적용할 수 없는 이유입니다. `target`은 상병 ID나 상병코드입니다. */
export const EncounterChangeError = Schema.Struct({
  reason: Schema.Literals(['DIAGNOSIS_NOT_FOUND', 'DIAGNOSIS_DUPLICATE']),
  target: Schema.String,
})
export type EncounterChangeError = typeof EncounterChangeError.Type

/** 없는 상병을 고치거나 지우려 했거나, 같은 상병코드가 둘이 됩니다. `errors`는 찾은 순서대로 모든 이유입니다. */
export class EncounterChangeInvalid extends HttpApiError.Problem<EncounterChangeInvalid>()(
  'EncounterChangeInvalid',
  { type: problemType('ENCOUNTER_CHANGE_INVALID'), status: 422, title: 'Encounter change is invalid' },
  { code: Schema.tag('ENCOUNTER_CHANGE_INVALID'), errors: Schema.Array(EncounterChangeError) },
) {}
