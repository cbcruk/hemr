import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServerError, HttpServerRespondable } from 'effect/http'
import { HttpApiBuilder, HttpApiMiddleware } from 'effect/http-api'
import { Api } from './api.ts'
import { VisitsHttpLive } from './modules/front-desk/visits/visits.http.ts'
import { Visits } from './modules/front-desk/visits/visits.ts'
import { Internal, NotFound } from './shared/problem/problem.ts'

const SystemLive = HttpApiBuilder.group(Api, 'system', (handlers) =>
  handlers.handle('health', () => Effect.succeed({ status: 'ok' as const })),
)

/**
 * 일치하는 경로가 없거나 예상하지 못한 오류(defect)가 나면 Problem Details로 응답합니다.
 *
 * 엔드포인트에 선언한 오류는 여기까지 오지 않고, 해당 경로가 직접 응답으로 바꿉니다.
 */
const ProblemFallback = HttpRouter.middleware(
  (httpEffect) =>
    httpEffect.pipe(
      Effect.catchIf(isRouteNotFound, () => HttpServerRespondable.toResponse(new NotFound({}))),
      Effect.catchDefect(() => HttpServerRespondable.toResponse(new Internal({}))),
    ),
  { global: true },
)

function isRouteNotFound(error: unknown): boolean {
  return error instanceof HttpServerError.HttpServerError && error.reason._tag === 'RouteNotFound'
}

/**
 * HTTP 서버에 올릴 수 있는 API 전체 경로입니다.
 *
 * 저장소는 호출하는 쪽이 `VisitRepository` Layer로 넣습니다.
 */
export const AppLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(SystemLive),
  Layer.provide(VisitsHttpLive.pipe(Layer.provide(Visits.layer))),
  Layer.provide(HttpApiMiddleware.layerProblemDetails()),
  Layer.merge(ProblemFallback),
)
