import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from 'effect/http-api'
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

const DurationSeconds = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 86_400 })).annotate({
  description: '시술 시간(초)입니다. 1초부터 하루(86400초)까지 받습니다.',
})

const AddPayload = Schema.Struct({
  name: Schema.String.check(Schema.isMaxLength(100), Schema.isPattern(/\S/)).annotate({
    description: '시술 이름입니다. 100자까지이고 공백만 있는 이름은 받지 않습니다.',
  }),
  // 기본값은 타이머 설정(`DEFAULT_PROCEDURE_TIMER_SETTINGS`)에서 옵니다
  durationSeconds: Schema.optionalKey(DurationSeconds),
  assignee: Schema.optionalKey(ProcedureAssignee),
  sourcePrescriptionLineId: Schema.optionalKey(PrescriptionLineId),
}).annotate({
  description: '시술 더하기 본문입니다. 시간이 없으면 기본 시술 시간(300초), 하는 사람이 없으면 `STAFF`입니다.',
})

const Procedures = Schema.Struct({ items: Schema.Array(Procedure) })
const visitParams = { id: VisitId }
const procedureParams = { id: ProcedureId }
const strict = { errors: 'all', onExcessProperty: 'error' } as const

/** 시술 하나에 보내는 상태 커맨드입니다. */
const procedureCommand = (name: 'complete' | 'restartTimer' | 'reopen', path: string, summary: string) =>
  HttpApiEndpoint.post(name, `/procedures/:id::${path}`, {
    params: procedureParams,
    success: Procedure,
    error:
      name === 'complete'
        ? [ProcedureNotFound, ProcedureTransitionInvalid]
        : [ProcedureNotFound, ProcedureTransitionInvalid, ProcedureVisitClosed],
  })
    .annotate(Access, Access.requires('procedure:write'))
    .annotate(OpenApi.Summary, summary)

/**
 * 치료실 그룹의 구현 메모입니다. API 설명은 `OpenApi.Description`에 있습니다.
 *
 * 조회는 `procedure:read`, 바꾸기는 `procedure:write`가 필요합니다.
 *
 * 타이머 만료는 서버가 판정합니다. 보드는 `serverTime`을 함께 줘, 클라이언트 시계가 어긋나도 남은 시간
 * (`timerEndsAt − serverTime`)을 맞게 그립니다. 시술 커맨드는 `If-Match`를 받지 않습니다.
 */
export class ProceduresApi extends HttpApiGroup.make('procedures')
  .add(
    HttpApiEndpoint.get('board', '/treatment-rooms/board', {
      query: {
        date: Schema.optionalKey(LocalDate.annotate({ description: '진료일입니다. 없으면 병원 시간대의 오늘입니다.' })),
      },
      success: Schema.Struct({
        serverTime: Schema.String.annotate({
          description: '서버 시각입니다. 남은 시간은 `timerEndsAt − serverTime`으로 그립니다.',
        }),
        items: Schema.Array(Schema.Struct({ visit: Visit, procedures: Schema.Array(Procedure) })),
      }),
    })
      // 내원 전체(보험구분·자격 등)를 함께 주므로 내원 조회 권한도 봅니다
      .annotate(Access, Access.requires('procedure:read', 'visit:read'))
      .annotate(OpenApi.Summary, '치료실 보드'),
    HttpApiEndpoint.get('listForVisit', '/visits/:id/procedures', {
      params: visitParams,
      success: Procedures,
      error: VisitNotFound,
    })
      .annotate(Access, Access.requires('procedure:read'))
      .annotate(OpenApi.Summary, '내원의 시술 목록'),
    HttpApiEndpoint.post('add', '/visits/:id/procedures', {
      params: visitParams,
      payload: AddPayload,
      success: Procedure.pipe(HttpApiSchema.status(201)),
      error: [VisitNotFound, ProcedureVisitClosed, ProcedureLimitExceeded],
    })
      .annotate(Access, Access.requires('procedure:write'))
      .annotate(OpenApi.Summary, '시술 더하기')
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.patch('setDuration', '/procedures/:id', {
      params: procedureParams,
      payload: Schema.Struct({ durationSeconds: DurationSeconds }),
      success: Procedure,
      error: [ProcedureNotFound, ProcedureTransitionInvalid, ProcedureVisitClosed, ProcedureDurationRejected],
    })
      .annotate(Access, Access.requires('procedure:write'))
      .annotate(OpenApi.Summary, '시술 시간 바꾸기')
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.delete('remove', '/procedures/:id', {
      params: procedureParams,
      success: HttpApiSchema.NoContent,
      error: [ProcedureNotFound, ProcedureTransitionInvalid],
    })
      .annotate(Access, Access.requires('procedure:write'))
      .annotate(OpenApi.Summary, '시술 지우기 (대기 시술만)'),
    HttpApiEndpoint.post('start', '/procedures/:id::start', {
      params: procedureParams,
      // 같은 내원에서 함께 완료한 만료 시술도 담습니다
      success: Procedures,
      error: [ProcedureNotFound, ProcedureTransitionInvalid, ProcedureVisitClosed],
    })
      .annotate(Access, Access.requires('procedure:write'))
      .annotate(OpenApi.Summary, '시술 시작'),
    procedureCommand('complete', 'complete', '시술 완료'),
    procedureCommand('restartTimer', 'restart-timer', '타이머 다시 시작'),
    procedureCommand('reopen', 'reopen', '시술 다시 열기 (대기로)'),
    HttpApiEndpoint.post('startAll', '/visits/:id/procedures::start-all', {
      params: visitParams,
      success: Procedures,
      error: [VisitNotFound, ProcedureVisitClosed],
    })
      .annotate(Access, Access.requires('procedure:write'))
      .annotate(OpenApi.Summary, '내원의 시술 모두 시작'),
    HttpApiEndpoint.post('completeAll', '/visits/:id/procedures::complete-all', {
      params: visitParams,
      success: Procedures,
      error: VisitNotFound,
    })
      .annotate(Access, Access.requires('procedure:write'))
      .annotate(OpenApi.Summary, '내원의 시술 모두 완료'),
    HttpApiEndpoint.put('reorder', '/visits/:id/procedures::reorder', {
      params: visitParams,
      payload: Schema.Struct({
        ids: Schema.Array(ProcedureId)
          .check(Schema.isMaxLength(MAX_PROCEDURES_PER_VISIT))
          .annotate({ description: '새 순서의 시술 ID입니다. 내원의 시술을 빠짐없이 한 번씩 보냅니다.' }),
      }),
      success: Procedures,
      error: [VisitNotFound, ProcedureOrderInvalid],
    })
      .annotate(Access, Access.requires('procedure:write'))
      .annotate(OpenApi.Summary, '시술 순서 바꾸기')
      .annotate(HttpApi.PayloadParseOptions, strict),
  )
  .annotate(
    OpenApi.Description,
    '치료실 보드와 시술입니다. 시술은 내원에 딸리고 타이머로 진행합니다. 타이머 만료는 서버가 판정하고, 보드의 `serverTime`으로 남은 시간을 그립니다. 시작(`:start`)은 같은 내원의 만료 시술을 함께 완료하므로 바뀐 시술 모두를 `items`로 줍니다. 시술 커맨드는 `If-Match`를 받지 않고, 같은 시술을 두 번 시작하면 뒤 요청이 409입니다. 취소했거나 수납까지 끝난 내원에는 시술을 더하거나 진행할 수 없습니다(409). 다른 병원의 내원·시술은 없는 것과 같이 404입니다.',
  )
  .middleware(Authorization) {}
