import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import { Access } from '../../identity/auth/access.ts'
import { PermissionDenied } from '../../identity/auth/auth-errors.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import { Visit, VisitDatePast, VisitHasClinicalData, VisitId, VisitNotFound, VisitTransitionInvalid } from './visit.ts'

const params = { id: VisitId }
/** 다른 사람의 변경을 덮어쓰지 않도록 보내는 버전입니다. 예: `"7"` */
const headers = { 'if-match': Schema.optionalKey(Schema.String) }
/** 바뀐 내원과, 다음 요청의 `If-Match`에 쓸 `ETag`입니다. */
const success = HttpApiSchema.WithHeaders(Visit, { etag: Schema.String })
const errors = [VisitNotFound, VisitTransitionInvalid, VersionMismatch]
const flowErrors = [...errors, VisitDatePast]

/**
 * 내원 상태 커맨드입니다. `POST /visits/{id}:{command}`로 보냅니다.
 *
 * 라우터는 `::`를 콜론 문자로 읽으므로 `/:id::cancel`이 `/vis_01J...:cancel`과 일치합니다.
 *
 * 진료 흐름과 다시 열기는 `visit:update`, 취소는 `visit:cancel`이 필요합니다. 연쇄 취소(`cascade: true`)는 본문에 따라
 * 정해지므로 `receipt:void`·`encounter:retract`를 서비스(`Visits.apply`)가 더 확인합니다 (D3).
 */
export class VisitsApi extends HttpApiGroup.make('visits')
  .add(
    HttpApiEndpoint.post('startTreatment', '/:id::start-treatment', {
      params,
      headers,
      success,
      error: flowErrors,
    }).annotate(Access, Access.requires('visit:update')),
    HttpApiEndpoint.post('returnToWaiting', '/:id::return-to-waiting', {
      params,
      headers,
      success,
      error: flowErrors,
    }).annotate(Access, Access.requires('visit:update')),
    HttpApiEndpoint.post('sendToCheckout', '/:id::send-to-checkout', {
      params,
      headers,
      success,
      error: flowErrors,
    }).annotate(Access, Access.requires('visit:update')),
    HttpApiEndpoint.post('reopen', '/:id::reopen', {
      params,
      headers,
      payload: Schema.Struct({
        reason: Schema.NonEmptyString,
        /** 다시 연 뒤 이어서 옮길 상태입니다. 없으면 `AWAITING_PAYMENT`에 머뭅니다. */
        then: Schema.optionalKey(Schema.Literals(['WAITING', 'IN_TREATMENT'])),
      }),
      success,
      error: flowErrors,
    }).annotate(Access, Access.requires('visit:update')),
    HttpApiEndpoint.post('cancel', '/:id::cancel', {
      params,
      headers,
      payload: Schema.Struct({ reason: Schema.NonEmptyString, cascade: Schema.optionalKey(Schema.Boolean) }),
      success,
      error: [...errors, VisitHasClinicalData, PermissionDenied],
    }).annotate(Access, Access.requires('visit:cancel')),
  )
  .middleware(Authorization)
  .prefix('/visits') {}
