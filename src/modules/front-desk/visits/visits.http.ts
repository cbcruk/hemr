import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'
import { Api } from '../../../api.ts'
import type { VisitHasClinicalData } from './visit.ts'
import { Visits } from './visits.ts'

/** 연쇄 취소가 필요한 커맨드는 취소뿐이라, 다른 커맨드는 이 오류로 실패하지 않습니다. */
function withoutCascade<A, E, R>(
  effect: Effect.Effect<A, E | VisitHasClinicalData, R>,
): Effect.Effect<A, Exclude<E, VisitHasClinicalData>, R> {
  return effect.pipe(Effect.catchTag('VisitHasClinicalData', Effect.die)) as Effect.Effect<
    A,
    Exclude<E, VisitHasClinicalData>,
    R
  >
}

/** 내원 상태 커맨드 핸들러입니다. */
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
