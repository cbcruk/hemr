import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
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
 */
export class VisitsApi extends HttpApiGroup.make('visits')
  .add(
    HttpApiEndpoint.post('startTreatment', '/:id::start-treatment', { params, headers, success, error: flowErrors }),
    HttpApiEndpoint.post('returnToWaiting', '/:id::return-to-waiting', {
      params,
      headers,
      success,
      error: flowErrors,
    }),
    HttpApiEndpoint.post('sendToCheckout', '/:id::send-to-checkout', { params, headers, success, error: flowErrors }),
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
    }),
    HttpApiEndpoint.post('cancel', '/:id::cancel', {
      params,
      headers,
      payload: Schema.Struct({ reason: Schema.NonEmptyString, cascade: Schema.optionalKey(Schema.Boolean) }),
      success,
      error: [...errors, VisitHasClinicalData],
    }),
  )
  .prefix('/visits') {}
