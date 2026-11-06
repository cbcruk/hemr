import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'
import { Api } from '../../../api.ts'
import { expectedVersion, withEtag } from '../../../shared/http/etag.ts'
import { Visits } from './visits.ts'

/**
 * 이 엔드포인트에서 나올 수 없는 오류를 타입에서 뺍니다.
 *
 * 연쇄 취소 오류는 취소에서만, 지난 날짜 오류는 진료 흐름 커맨드에서만 생깁니다.
 */
function cannotFail<const Tag extends string>(tag: Tag) {
  return <A, E extends { readonly _tag: string }, R>(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, Exclude<E, { readonly _tag: Tag }>, R> =>
    effect.pipe(Effect.catchIf((error: E) => error._tag === tag, Effect.die)) as Effect.Effect<
      A,
      Exclude<E, { readonly _tag: Tag }>,
      R
    >
}

/** 내원 상태 커맨드 핸들러입니다. */
export const VisitsHttpLive = HttpApiBuilder.group(
  Api,
  'visits',
  Effect.fn(function* (handlers) {
    const visits = yield* Visits
    // 연쇄 취소 오류와 그 권한 확인은 취소에서만 생깁니다
    const noCascade = <A, E extends { readonly _tag: string }, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(cannotFail('VisitHasClinicalData'), cannotFail('PermissionDenied'))

    return handlers.handleAll({
      startTreatment: ({ params, headers }) =>
        visits
          .apply(params.id, 'START_TREATMENT', expectedVersion(headers['if-match']))
          .pipe(noCascade, Effect.map(withEtag)),
      returnToWaiting: ({ params, headers }) =>
        visits
          .apply(params.id, 'RETURN_TO_WAITING', expectedVersion(headers['if-match']))
          .pipe(noCascade, Effect.map(withEtag)),
      sendToCheckout: ({ params, headers }) =>
        visits
          .apply(params.id, 'SEND_TO_CHECKOUT', expectedVersion(headers['if-match']))
          .pipe(noCascade, Effect.map(withEtag)),
      reopen: ({ params, headers, payload }) =>
        visits
          .apply(params.id, 'REOPEN', { ...payload, ...expectedVersion(headers['if-match']) })
          .pipe(noCascade, Effect.map(withEtag)),
      cancel: ({ params, headers, payload }) =>
        visits
          .apply(params.id, 'CANCEL', { ...payload, ...expectedVersion(headers['if-match']) })
          .pipe(cannotFail('VisitDatePast'), Effect.map(withEtag)),
    })
  }),
)
