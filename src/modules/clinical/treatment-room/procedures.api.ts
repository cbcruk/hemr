import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api'
import { Visit, VisitId, VisitNotFound } from '../../front-desk/visits/visit.ts'
import { Access } from '../../identity/auth/access.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import { LocalDate } from '../../patients/patient.ts'
import { PrescriptionLineId } from '../prescriptions/prescription-line.ts'
import {
  Procedure,
  ProcedureAssignee,
  ProcedureDurationRejected,
  MAX_PROCEDURES_PER_VISIT,
  ProcedureId,
  ProcedureLimitExceeded,
  ProcedureNotFound,
  ProcedureOrderInvalid,
  ProcedureTransitionInvalid,
  ProcedureVisitClosed,
} from './procedure.ts'

/** 시술 시간(초)입니다. 1초부터 하루까지 받습니다. */
const DurationSeconds = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 86_400 }))

const AddPayload = Schema.Struct({
  // 공백만 있는 이름은 받지 않습니다
  name: Schema.String.check(Schema.isMaxLength(100), Schema.isPattern(/\S/)),
  durationSeconds: Schema.optionalKey(DurationSeconds),
  assignee: Schema.optionalKey(ProcedureAssignee),
  sourcePrescriptionLineId: Schema.optionalKey(PrescriptionLineId),
})

const Procedures = Schema.Struct({ items: Schema.Array(Procedure) })
const visitParams = { id: VisitId }
const procedureParams = { id: ProcedureId }
const strict = { errors: 'all', onExcessProperty: 'error' } as const

/** 시술 하나에 보내는 상태 커맨드입니다. */
const procedureCommand = (name: 'complete' | 'restartTimer' | 'reopen', path: string) =>
  HttpApiEndpoint.post(name, `/procedures/:id::${path}`, {
    params: procedureParams,
    success: Procedure,
    error:
      name === 'complete'
        ? [ProcedureNotFound, ProcedureTransitionInvalid]
        : [ProcedureNotFound, ProcedureTransitionInvalid, ProcedureVisitClosed],
  }).annotate(Access, Access.requires('procedure:write'))

/**
 * 치료실 보드와 시술입니다 (clinical.md 치료실). 조회는 `procedure:read`, 바꾸기는 `procedure:write`가 필요합니다.
 *
 * 타이머 만료는 서버가 판정합니다. 보드는 `serverTime`을 함께 줘, 클라이언트 시계가 어긋나도 남은 시간
 * (`timerEndsAt − serverTime`)을 맞게 그립니다. 시술 커맨드는 `If-Match`를 받지 않습니다.
 */
export class ProceduresApi extends HttpApiGroup.make('procedures')
  .add(
    HttpApiEndpoint.get('board', '/treatment-rooms/board', {
      query: { date: Schema.optionalKey(LocalDate) },
      success: Schema.Struct({
        serverTime: Schema.String,
        items: Schema.Array(Schema.Struct({ visit: Visit, procedures: Schema.Array(Procedure) })),
      }),
    })
      // 내원 전체(보험구분·자격 등)를 함께 주므로 내원 조회 권한도 봅니다
      .annotate(Access, Access.requires('procedure:read', 'visit:read')),
    HttpApiEndpoint.get('listForVisit', '/visits/:id/procedures', {
      params: visitParams,
      success: Procedures,
      error: VisitNotFound,
    }).annotate(Access, Access.requires('procedure:read')),
    HttpApiEndpoint.post('add', '/visits/:id/procedures', {
      params: visitParams,
      payload: AddPayload,
      success: Procedure.pipe(HttpApiSchema.status(201)),
      error: [VisitNotFound, ProcedureVisitClosed, ProcedureLimitExceeded],
    })
      .annotate(Access, Access.requires('procedure:write'))
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.patch('setDuration', '/procedures/:id', {
      params: procedureParams,
      payload: Schema.Struct({ durationSeconds: DurationSeconds }),
      success: Procedure,
      error: [ProcedureNotFound, ProcedureTransitionInvalid, ProcedureVisitClosed, ProcedureDurationRejected],
    })
      .annotate(Access, Access.requires('procedure:write'))
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.delete('remove', '/procedures/:id', {
      params: procedureParams,
      success: HttpApiSchema.NoContent,
      error: [ProcedureNotFound, ProcedureTransitionInvalid],
    }).annotate(Access, Access.requires('procedure:write')),
    HttpApiEndpoint.post('start', '/procedures/:id::start', {
      params: procedureParams,
      // 같은 내원에서 함께 완료한 만료 시술도 담습니다
      success: Procedures,
      error: [ProcedureNotFound, ProcedureTransitionInvalid, ProcedureVisitClosed],
    }).annotate(Access, Access.requires('procedure:write')),
    procedureCommand('complete', 'complete'),
    procedureCommand('restartTimer', 'restart-timer'),
    procedureCommand('reopen', 'reopen'),
    HttpApiEndpoint.post('startAll', '/visits/:id/procedures::start-all', {
      params: visitParams,
      success: Procedures,
      error: [VisitNotFound, ProcedureVisitClosed],
    }).annotate(Access, Access.requires('procedure:write')),
    HttpApiEndpoint.post('completeAll', '/visits/:id/procedures::complete-all', {
      params: visitParams,
      success: Procedures,
      error: VisitNotFound,
    }).annotate(Access, Access.requires('procedure:write')),
    HttpApiEndpoint.put('reorder', '/visits/:id/procedures::reorder', {
      params: visitParams,
      payload: Schema.Struct({ ids: Schema.Array(ProcedureId).check(Schema.isMaxLength(MAX_PROCEDURES_PER_VISIT)) }),
      success: Procedures,
      error: [VisitNotFound, ProcedureOrderInvalid],
    })
      .annotate(Access, Access.requires('procedure:write'))
      .annotate(HttpApi.PayloadParseOptions, strict),
  )
  .middleware(Authorization) {}
