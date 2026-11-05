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
 * Renders unmatched routes and defects as Problem Details.
 *
 * Declared endpoint errors never reach here; they are encoded by their route.
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
 * All routes of the API, ready to be served by an HTTP server.
 *
 * Storage is left to the caller, which provides a `VisitRepository` layer.
 */
export const AppLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(SystemLive),
  Layer.provide(VisitsHttpLive.pipe(Layer.provide(Visits.layer))),
  Layer.provide(HttpApiMiddleware.layerProblemDetails()),
  Layer.merge(ProblemFallback),
)
