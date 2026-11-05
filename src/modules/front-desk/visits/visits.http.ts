import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'
import { Api } from '../../../api.ts'
import type { VisitHasClinicalData } from './visit.ts'
import { Visits } from './visits.ts'

/** Only a cancel can need a cascade, so the other commands never fail this way. */
function withoutCascade<A, E, R>(
  effect: Effect.Effect<A, E | VisitHasClinicalData, R>,
): Effect.Effect<A, Exclude<E, VisitHasClinicalData>, R> {
  return effect.pipe(Effect.catchTag('VisitHasClinicalData', Effect.die)) as Effect.Effect<
    A,
    Exclude<E, VisitHasClinicalData>,
    R
  >
}

/** Handlers of the visit status commands. */
export const VisitsHttpLive = HttpApiBuilder.group(
  Api,
  'visits',
  Effect.fn(function* (handlers) {
    const visits = yield* Visits

    return handlers.handleAll({
      startTreatment: ({ params }) => visits.apply(params.id, 'START_TREATMENT').pipe(withoutCascade),
      returnToWaiting: ({ params }) => visits.apply(params.id, 'RETURN_TO_WAITING').pipe(withoutCascade),
      sendToCheckout: ({ params }) => visits.apply(params.id, 'SEND_TO_CHECKOUT').pipe(withoutCascade),
      reopen: ({ params, payload }) => visits.apply(params.id, 'REOPEN', payload).pipe(withoutCascade),
      cancel: ({ params, payload }) => visits.apply(params.id, 'CANCEL', payload),
    })
  }),
)
