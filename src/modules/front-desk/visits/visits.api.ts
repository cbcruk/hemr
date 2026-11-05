import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'
import { Visit, VisitHasClinicalData, VisitId, VisitNotFound, VisitTransitionInvalid } from './visit.ts'

const params = { id: VisitId }
const errors = [VisitNotFound, VisitTransitionInvalid]

/**
 * Status commands of a visit, sent as `POST /visits/{id}:{command}`.
 *
 * The router reads `::` as a literal colon, so `/:id::cancel` matches `/vis_01J...:cancel`.
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
