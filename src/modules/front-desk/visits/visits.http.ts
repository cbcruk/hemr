import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiSchema } from 'effect/http-api'
import { Api } from '../../../api.ts'
import type { Visit } from './visit.ts'
import type { VisitCommandInput } from './visits.ts'
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

/** `If-Match: "7"`(또는 `W/"7"`, `7`)에서 버전을 읽습니다. 숫자가 아니면 어떤 버전과도 맞지 않습니다. */
function expectedVersion(ifMatch: string | undefined): Pick<VisitCommandInput, 'expectedVersion'> {
  if (ifMatch === undefined) return {}
  const version = Number(ifMatch.replace(/^W\//, '').replaceAll('"', ''))
  return { expectedVersion: Number.isInteger(version) ? version : Number.NaN }
}

function withEtag(visit: Visit) {
  return HttpApiSchema.withHeaders({ body: visit, headers: { etag: `"${visit.version}"` } })
}

/** 내원 상태 커맨드 핸들러입니다. */
export const VisitsHttpLive = HttpApiBuilder.group(
  Api,
  'visits',
  Effect.fn(function* (handlers) {
    const visits = yield* Visits
    const noCascade = cannotFail('VisitHasClinicalData')

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
