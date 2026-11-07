import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'
import { TenantId, UserId } from '../../identity/identity.ts'
import { PatientId } from '../../patients/patient.ts'
import { BenefitFlags, Coverage, VisitId } from '../../front-desk/visits/visit.ts'
import { PrescriptionLine } from '../prescriptions/prescription-line.ts'
import { EncounterId } from './encounter-id.ts'

export { EncounterId }

export const DiagnosisId = Schema.String.annotate({ description: '상병 ID입니다. 예: `dx_01J...`' }).pipe(
  Schema.refine((value): value is Id<'diagnosis'> => isId('diagnosis', value)),
)

// 마스터에 있는 코드인지는 참조데이터(`/reference/diagnoses-kcd`)가 생길 때 확인합니다
export const DiagnosisCode = Schema.String.check(Schema.isPattern(/^[A-Z]\d{2}(\.[0-9A-Z]{1,3})?$/)).annotate({
  description:
    'KCD 상병코드입니다. 영문 대문자 하나, 숫자 둘, 그 뒤 `.`과 세부 분류 1–3자입니다. 예: `U23.4`, `M54.56`',
})

export const DiagnosisKind = Schema.Literals(['PRIMARY', 'SECONDARY']).annotate({
  identifier: 'DiagnosisKind',
  description: '주상병(`PRIMARY`)과 부상병(`SECONDARY`)입니다. 완료하려면 주상병이 하나 있어야 합니다.',
})

export const Diagnosis = Schema.Struct({
  id: DiagnosisId,
  code: DiagnosisCode,
  kind: DiagnosisKind,
}).annotate({
  identifier: 'Diagnosis',
  title: '상병',
  description: '진료의 상병입니다. 한 진료에 같은 상병코드는 하나입니다.',
})
export type Diagnosis = typeof Diagnosis.Type

export const ClinicalNote = Schema.Struct({
  body: Schema.String.annotate({ description: '편집기가 만든 HTML 그대로입니다.' }),
}).annotate({ identifier: 'ClinicalNote', title: '진료기록', description: '진료기록 본문입니다.' })
export type ClinicalNote = typeof ClinicalNote.Type

export const EncounterStatus = Schema.Literals(['DRAFT', 'COMPLETED', 'AMENDED', 'ENTERED_IN_ERROR']).annotate({
  identifier: 'EncounterStatus',
  title: '진료 상태',
  description:
    '초안(`DRAFT`), 완료(`COMPLETED`), 정정됨(`AMENDED`), 철회(`ENTERED_IN_ERROR`)입니다. 진료 `COMPLETED`는 내원 `COMPLETED`(수납완료)와 다릅니다.',
})

export const EncounterType = Schema.Literals(['OFFICE', 'HOME_VISIT', 'TELEMEDICINE']).annotate({
  identifier: 'EncounterType',
  description:
    '진료 방식입니다. 내원(`OFFICE`), 방문진료(`HOME_VISIT`), 비대면(`TELEMEDICINE`)입니다. 지금은 내원 접수로 만드는 `OFFICE`만 있습니다.',
})

// 활력징후·서명·`allowedActions`는 그 기능이 생길 때 더합니다
export const Encounter = Schema.Struct({
  id: EncounterId,
  // 다른 병원의 진료는 없는 것과 같이 다룹니다(404)
  tenantId: TenantId,
  patientId: PatientId,
  visitId: Schema.NullOr(VisitId).annotate({
    description: '진료를 만든 내원입니다. 방문진료처럼 내원 없는 진료는 `null`입니다.',
  }),
  doctorId: Schema.NullOr(UserId).annotate({
    description: '진료한 한의사입니다. 접수 때는 모르므로 `null`이고, 처음 기록을 저장한 사용자로 채웁니다.',
  }),
  encounterType: EncounterType,
  coverage: Coverage,
  serviceAt: Schema.String.annotate({
    description:
      '진료 기준 시각입니다(현행 기준일시). 참조데이터·수가는 이 시각으로 고릅니다. 내원 진료는 접수 시각입니다.',
  }),
  note: ClinicalNote,
  diagnoses: Schema.Array(Diagnosis).annotate({ description: '저장한 순서입니다.' }),
  prescriptionLines: Schema.Array(PrescriptionLine).annotate({ description: '저장한 순서입니다.' }),
  benefitFlags: BenefitFlags,
  status: EncounterStatus,
  completedAt: Schema.NullOr(Schema.String).annotate({
    description: '처음 완료한 시각입니다. 완료 전에는 `null`입니다. 정정해도 바뀌지 않습니다.',
  }),
  revision: Schema.Int.annotate({
    description:
      '진료기록 판입니다. 초안은 0, 완료하면 1, 정정할 때마다 1씩 오릅니다. 판마다 그때 내용이 `/encounters/{id}/versions/{n}`에 남습니다. 낙관적 잠금 `version`과 다릅니다.',
  }),
  locked: Schema.Boolean.annotate({
    description: '고정한 기록입니다(현행 고정된기록여부). 고정하면 정정·철회할 수 없습니다.',
  }),
  retraction: Schema.NullOr(
    Schema.Struct({ reason: Schema.String, retractedAt: Schema.String, retractedBy: Schema.NullOr(UserId) }),
  ).annotate({ description: '철회(`ENTERED_IN_ERROR`)한 사유와 시각입니다. 철회하지 않았으면 `null`입니다.' }),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  version: Schema.Int.annotate({
    description: '낙관적 잠금 버전입니다. 응답의 `ETag`로 주고 `If-Match`로 받습니다.',
  }),
}).annotate({
  identifier: 'Encounter',
  title: '진료',
  description:
    '진료입니다. 내원 하나에 하나 생기고, 보험구분(`coverage`)과 `benefitFlags`는 내원에서 복사합니다. 전체 리소스는 `docs/design/clinical.md`를 보세요.',
})
export type Encounter = typeof Encounter.Type

export const EncounterWarning = Schema.Struct({
  code: Schema.Literals([
    'PRIMARY_DIAGNOSIS_MISSING',
    'PRIMARY_DIAGNOSIS_MULTIPLE',
    'COVERAGE_CATEGORY_MISMATCH',
  ]).annotate({
    description: '주상병 없음, 주상병 둘 이상, 보험구분에 맞지 않는 처방입니다.',
  }),
  message: Schema.String,
  targets: Schema.optionalKey(Schema.Array(Schema.String).annotate({ description: '문제가 있는 처방 라인 ID입니다.' })),
}).annotate({
  identifier: 'EncounterWarning',
  description: '저장은 통과했지만 완료 전에 고쳐야 하는 것입니다. 완료는 같은 이유로 막힙니다.',
})
export type EncounterWarning = typeof EncounterWarning.Type

/** 요청한 ID의 진료가 없습니다. */
export class EncounterNotFound extends HttpApiError.Problem<EncounterNotFound>()(
  'EncounterNotFound',
  { type: problemType('ENCOUNTER_NOT_FOUND'), status: 404, title: 'Encounter not found' },
  { code: Schema.tag('ENCOUNTER_NOT_FOUND') },
) {}

/**
 * 진료의 상태에서 할 수 없는 커맨드입니다. 초안만 `PATCH`·완료할 수 있고(완료한 진료는 정정 `:amend`), 완료·정정한
 * 진료만 정정·고정할 수 있고, 철회한 진료는 아무것도 할 수 없습니다.
 */
export class EncounterNotEditable extends HttpApiError.Problem<EncounterNotEditable>()(
  'EncounterNotEditable',
  { type: problemType('ENCOUNTER_NOT_EDITABLE'), status: 409, title: 'Encounter status does not allow this command' },
  { code: Schema.tag('ENCOUNTER_NOT_EDITABLE'), currentStatus: EncounterStatus },
) {}

/** 취소한 내원의 진료입니다. 내원을 다시 열거나, 철회(`:retract`)가 생기면 철회합니다. */
export class EncounterVisitCanceled extends HttpApiError.Problem<EncounterVisitCanceled>()(
  'EncounterVisitCanceled',
  { type: problemType('ENCOUNTER_VISIT_CANCELED'), status: 409, title: 'Visit of the encounter is canceled' },
  { code: Schema.tag('ENCOUNTER_VISIT_CANCELED') },
) {}

export const EncounterChangeError = Schema.Struct({
  reason: Schema.Literals([
    'DIAGNOSIS_NOT_FOUND',
    'DIAGNOSIS_DUPLICATE',
    'PRESCRIPTION_LINE_NOT_FOUND',
    'PRESCRIPTION_LINE_DUPLICATE',
  ]),
  target: Schema.String.annotate({ description: '상병 ID·상병코드나 처방 라인 ID·`clientRef`입니다.' }),
}).annotate({ identifier: 'EncounterChangeError', description: '변경을 적용할 수 없는 이유입니다.' })
export type EncounterChangeError = typeof EncounterChangeError.Type

/** 없는 상병·처방 라인을 고치거나 지우려 했거나, 같은 상병코드가 둘이 되거나, 한 요청에 같은 라인을 두 번 보냈습니다. `errors`는 찾은 순서대로 모든 이유입니다. */
export class EncounterChangeInvalid extends HttpApiError.Problem<EncounterChangeInvalid>()(
  'EncounterChangeInvalid',
  { type: problemType('ENCOUNTER_CHANGE_INVALID'), status: 422, title: 'Encounter change is invalid' },
  { code: Schema.tag('ENCOUNTER_CHANGE_INVALID'), errors: Schema.Array(EncounterChangeError) },
) {}

export const CompletionViolation = Schema.Struct({
  code: Schema.Literals([
    'PRIMARY_DIAGNOSIS_MISSING',
    'PRIMARY_DIAGNOSIS_MULTIPLE',
    'COVERAGE_CATEGORY_MISMATCH',
    'PILOT_HERBAL_NOT_APPROVED',
    'DUPLICATE_CONSULTATION_FEE',
  ]).annotate({
    description:
      '주상병 없음, 주상병 둘 이상, 보험구분에 맞지 않는 처방, 심평원 승인 전 첩약 시범사업 처방, 같은 날 진찰료 중복입니다. 진찰료 중복만 `acknowledge`로 넘길 수 있습니다.',
  }),
  message: Schema.String,
  targets: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description: '문제가 있는 처방 라인 ID나, 진찰료가 겹치는 다른 진료 ID입니다.',
    }),
  ),
}).annotate({ identifier: 'CompletionViolation', description: '완료를 막는 이유입니다.' })
export type CompletionViolation = typeof CompletionViolation.Type

/** 완료 검증이 막았습니다. `violations`는 검사 순서대로 모든 이유입니다. */
export class EncounterCompletionRejected extends HttpApiError.Problem<EncounterCompletionRejected>()(
  'EncounterCompletionRejected',
  { type: problemType('ENCOUNTER_COMPLETION_REJECTED'), status: 422, title: 'Encounter completion rejected' },
  { code: Schema.tag('ENCOUNTER_COMPLETION_REJECTED'), violations: Schema.Array(CompletionViolation) },
) {}

/**
 * 수납한 진료라 처방을 바꾸거나 철회할 수 없습니다. 영수증 금액과 진료 처방이 어긋나지 않게, 먼저 영수증을
 * 취소합니다(`:void`). 정정은 같은 진료를 다시 수납하므로 잠금을 풀지 않습니다. 본문·상병은 바꿀 수 있습니다.
 */
export class EncounterBilled extends HttpApiError.Problem<EncounterBilled>()(
  'EncounterBilled',
  { type: problemType('ENCOUNTER_BILLED'), status: 409, title: 'Encounter is on an active receipt' },
  { code: Schema.tag('ENCOUNTER_BILLED'), receiptId: Schema.String },
) {}

/** 고정한 진료라 정정·철회할 수 없습니다. 먼저 고정을 풉니다(`:unlock`). */
export class EncounterLocked extends HttpApiError.Problem<EncounterLocked>()(
  'EncounterLocked',
  { type: problemType('ENCOUNTER_LOCKED'), status: 409, title: 'Encounter is locked' },
  { code: Schema.tag('ENCOUNTER_LOCKED') },
) {}

export const EncounterRevision = Schema.Struct({
  encounterId: EncounterId,
  revision: Schema.Int.annotate({ description: '판 번호입니다. 1부터입니다.' }),
  note: ClinicalNote,
  diagnoses: Schema.Array(Diagnosis),
  prescriptionLines: Schema.Array(PrescriptionLine),
  // 청구 자동수정·AI 보조 정정은 그 기능이 생길 때 더합니다
  source: Schema.Literals(['COMPLETION', 'AMENDMENT']).annotate({
    description: '`COMPLETION`은 완료, `AMENDMENT`는 정정으로 남은 판입니다.',
  }),
  reason: Schema.NullOr(Schema.String).annotate({ description: '정정 사유입니다. 완료한 판은 `null`입니다.' }),
  recordedBy: Schema.NullOr(UserId).annotate({
    description: '이 판을 남긴 사용자입니다. 이전 시스템에서 옮긴 판에서 진료의를 모르면 `null`입니다.',
  }),
  recordedAt: Schema.String,
}).annotate({
  identifier: 'EncounterRevision',
  title: '판',
  description:
    '진료기록의 한 판입니다. 완료할 때 1판, 정정할 때마다 다음 판을 남깁니다. 한 번 쓰면 고치거나 지우지 않습니다.',
})
export type EncounterRevision = typeof EncounterRevision.Type

/** 요청한 판이 없습니다. */
export class EncounterRevisionNotFound extends HttpApiError.Problem<EncounterRevisionNotFound>()(
  'EncounterRevisionNotFound',
  { type: problemType('ENCOUNTER_REVISION_NOT_FOUND'), status: 404, title: 'Encounter revision not found' },
  { code: Schema.tag('ENCOUNTER_REVISION_NOT_FOUND') },
) {}
