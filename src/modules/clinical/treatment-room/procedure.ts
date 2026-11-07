import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'
import { TenantId } from '../../identity/identity.ts'
import { PatientId } from '../../patients/patient.ts'
import { VisitId } from '../../front-desk/visits/visit.ts'
import { PrescriptionLineId } from '../prescriptions/prescription-line.ts'

// 설명은 `refine` 앞에 답니다. 뒤에 달면 OpenAPI 문서에서 빠집니다
export const ProcedureId = Schema.String.annotate({ description: '시술 ID입니다. 예: `prc_01J...`' }).pipe(
  Schema.refine((value): value is Id<'procedure'> => isId('procedure', value)),
)

// 판정은 `procedure-timer.ts`가 합니다
export const ProcedureStatus = Schema.Literals(['PENDING', 'RUNNING', 'TIMER_ELAPSED', 'DONE']).annotate({
  identifier: 'ProcedureStatus',
  title: '시술 상태',
  description:
    '대기(`PENDING`), 진행 중(`RUNNING`), 타이머 만료(`TIMER_ELAPSED`), 완료(`DONE`)입니다. 타이머 만료는 서버가 판정합니다.',
})

export const ProcedureAssignee = Schema.Literals(['DOCTOR', 'STAFF']).annotate({
  identifier: 'ProcedureAssignee',
  description:
    '시술을 하는 사람입니다. 의사가 직접 하는 시술(`DOCTOR`, 침 등)과 치료사가 하는 시술(`STAFF`, 물리치료 등)입니다.',
})

// 치료실·베드 배정과 치료세트는 그 설정이 생길 때 더합니다
export const Procedure = Schema.Struct({
  id: ProcedureId,
  tenantId: TenantId,
  visitId: VisitId,
  patientId: PatientId,
  name: Schema.String,
  sourcePrescriptionLineId: Schema.NullOr(PrescriptionLineId).annotate({
    description:
      '이 시술을 만든 처방 라인입니다. 직접 더한 시술은 `null`입니다. 진료에 그 라인이 있는지는 보지 않습니다.',
  }),
  order: Schema.Int.annotate({ description: '내원 안에서의 순서입니다. 0부터입니다.' }),
  assignee: ProcedureAssignee,
  durationSeconds: Schema.Int.annotate({ description: '시술 시간(초)입니다.' }),
  status: ProcedureStatus,
  startedAt: Schema.NullOr(Schema.String).annotate({
    description: '마지막으로 시작한 시각입니다. 대기(`PENDING`)면 `null`입니다.',
  }),
  timerEndsAt: Schema.NullOr(Schema.String).annotate({
    description:
      '타이머가 끝나는 시각입니다. 진행 중에는 `startedAt + durationSeconds`이고, 만료한 뒤 시간을 바꿔도 실제로 끝난 시각을 지킵니다. 대기면 `null`입니다.',
  }),
  completedAt: Schema.NullOr(Schema.String).annotate({
    description: '완료한 시각입니다. 완료 전이나 다시 연 뒤에는 `null`입니다.',
  }),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  version: Schema.Int,
}).annotate({
  identifier: 'Procedure',
  title: '시술',
  description:
    '치료실 시술입니다. 내원에 딸리고, 한 내원의 시술이 순서대로 진행됩니다. 지금은 내원 하나를 베드 하나로 봅니다. 전체 리소스는 `docs/design/clinical.md`를 보세요.',
})
export type Procedure = typeof Procedure.Type

/** 요청한 ID의 시술이 없습니다. */
export class ProcedureNotFound extends HttpApiError.Problem<ProcedureNotFound>()(
  'ProcedureNotFound',
  { type: problemType('PROCEDURE_NOT_FOUND'), status: 404, title: 'Procedure not found' },
  { code: Schema.tag('PROCEDURE_NOT_FOUND') },
) {}

/** 시술 상태에서 할 수 없는 커맨드입니다. 예: 진행 중인 시술 다시 시작, 대기 시술 완료, 대기가 아닌 시술 삭제 */
export class ProcedureTransitionInvalid extends HttpApiError.Problem<ProcedureTransitionInvalid>()(
  'ProcedureTransitionInvalid',
  {
    type: problemType('PROCEDURE_TRANSITION_INVALID'),
    status: 409,
    title: 'Procedure status does not allow this command',
  },
  { code: Schema.tag('PROCEDURE_TRANSITION_INVALID'), currentStatus: ProcedureStatus },
) {}

/** 진행 중인 시술의 새 시간이 서버 시계 기준 지난 시간 + 1초보다 짧습니다. */
export class ProcedureDurationRejected extends HttpApiError.Problem<ProcedureDurationRejected>()(
  'ProcedureDurationRejected',
  { type: problemType('PROCEDURE_DURATION_REJECTED'), status: 422, title: 'Procedure duration rejected' },
  {
    code: Schema.tag('PROCEDURE_DURATION_REJECTED'),
    reason: Schema.Literals(['PROCEDURE_DURATION_TOO_SHORT']),
  },
) {}

/** 취소했거나 수납까지 끝난 내원에는 시술을 더하거나 진행할 수 없습니다. */
export class ProcedureVisitClosed extends HttpApiError.Problem<ProcedureVisitClosed>()(
  'ProcedureVisitClosed',
  { type: problemType('PROCEDURE_VISIT_CLOSED'), status: 409, title: 'Visit of the procedure is closed' },
  { code: Schema.tag('PROCEDURE_VISIT_CLOSED') },
) {}

/** 내원 하나의 시술 수 상한입니다. 순서 변경이 모든 시술 ID를 한 번에 받으므로 같은 상한을 씁니다. */
export const MAX_PROCEDURES_PER_VISIT = 100

/** 내원에 시술이 이미 `MAX_PROCEDURES_PER_VISIT`개 있습니다. */
export class ProcedureLimitExceeded extends HttpApiError.Problem<ProcedureLimitExceeded>()(
  'ProcedureLimitExceeded',
  { type: problemType('PROCEDURE_LIMIT_EXCEEDED'), status: 422, title: 'Too many procedures on the visit' },
  { code: Schema.tag('PROCEDURE_LIMIT_EXCEEDED') },
) {}

/** 순서를 바꿀 때 내원의 시술 ID를 빠짐없이 한 번씩 보내지 않았습니다. */
export class ProcedureOrderInvalid extends HttpApiError.Problem<ProcedureOrderInvalid>()(
  'ProcedureOrderInvalid',
  {
    type: problemType('PROCEDURE_ORDER_INVALID'),
    status: 422,
    title: 'Procedure order must list every procedure once',
  },
  { code: Schema.tag('PROCEDURE_ORDER_INVALID') },
) {}
