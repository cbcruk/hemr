import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'
import { Visit, VisitHasClinicalData, VisitId, VisitNotFound, VisitTransitionInvalid } from './visit.ts'

const params = { id: VisitId }
const errors = [VisitNotFound, VisitTransitionInvalid]

/**
 * 내원 상태 커맨드입니다. `POST /visits/{id}:{command}`로 보냅니다.
 *
 * 라우터는 `::`를 콜론 문자로 읽으므로 `/:id::cancel`이 `/vis_01J...:cancel`과 일치합니다.
 */
export class VisitsApi extends HttpApiGroup.make('visits')
  .add(
    HttpApiEndpoint.post('startTreatment', '/:id::start-treatment', { params, success: Visit, error: errors }),
    HttpApiEndpoint.post('returnToWaiting', '/:id::return-to-waiting', { params, success: Visit, error: errors }),
    HttpApiEndpoint.post('sendToCheckout', '/:id::send-to-checkout', { params, success: Visit, error: errors }),
    HttpApiEndpoint.post('reopen', '/:id::reopen', {
      params,
      payload: Schema.Struct({ reason: Schema.NonEmptyString }),
      success: Visit,
      error: errors,
    }),
    HttpApiEndpoint.post('cancel', '/:id::cancel', {
      params,
      payload: Schema.Struct({ reason: Schema.NonEmptyString, cascade: Schema.optionalKey(Schema.Boolean) }),
      success: Visit,
      error: [...errors, VisitHasClinicalData],
    }),
  )
  .prefix('/visits') {}
