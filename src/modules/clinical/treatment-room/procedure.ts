import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'
import { TenantId } from '../../identity/identity.ts'
import { PatientId } from '../../patients/patient.ts'
import { VisitId } from '../../front-desk/visits/visit.ts'
import { PrescriptionLineId } from '../prescriptions/prescription-line.ts'

/** 시술 ID입니다. 예: `prc_01J...` */
export const ProcedureId = Schema.String.pipe(
  Schema.refine((value): value is Id<'procedure'> => isId('procedure', value)),
)

/** 시술 상태입니다 (clinical.md 치료실 상태도). 판정은 `procedure-timer.ts`가 합니다. */
export const ProcedureStatus = Schema.Literals(['PENDING', 'RUNNING', 'TIMER_ELAPSED', 'DONE'])

/** 시술을 하는 사람입니다. 의사가 직접 하는 시술(침 등)과 치료사가 하는 시술(물리치료 등)을 나눕니다. */
export const ProcedureAssignee = Schema.Literals(['DOCTOR', 'STAFF'])

/**
 * 치료실 시술입니다. 내원에 딸리고, 한 내원의 시술이 한 베드에서 순서대로 진행됩니다.
 *
 * 지금은 치료실·베드 배정과 치료세트가 없어 내원 하나를 베드 하나로 봅니다. 전체 리소스는 `docs/design/clinical.md`를
 * 보세요.
 */
export const Procedure = Schema.Struct({
  id: ProcedureId,
  tenantId: TenantId,
  visitId: VisitId,
  patientId: PatientId,
  name: Schema.String,
  /** 이 시술을 만든 처방 라인입니다. 직접 더한 시술은 `null`입니다. */
  sourcePrescriptionLineId: Schema.NullOr(PrescriptionLineId),
  /** 내원 안에서의 순서입니다. 0부터입니다. */
  order: Schema.Int,
  assignee: ProcedureAssignee,
  durationSeconds: Schema.Int,
  status: ProcedureStatus,
  /** 마지막으로 시작한 시각입니다. 대기(`PENDING`)면 `null`입니다. */
  startedAt: Schema.NullOr(Schema.String),
  /** 타이머가 끝나는 시각입니다. `startedAt + durationSeconds`입니다. 대기면 `null`입니다. */
  timerEndsAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  version: Schema.Int,
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
