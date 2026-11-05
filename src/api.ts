import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware } from 'effect/http-api'
import { VisitsApi } from './modules/front-desk/visits/visits.api.ts'

/** Liveness check for load balancers and local development. */
export class SystemApi extends HttpApiGroup.make('system').add(
  HttpApiEndpoint.get('health', '/health', {
    success: Schema.Struct({ status: Schema.Literal('ok') }),
  }),
) {}

/**
 * HTTP contract of the backend, with every route under `/v1`.
 *
 * Request decoding failures are rendered as RFC 9457 Problem Details.
 */
export class Api extends HttpApi.make('hemr')
  .add(SystemApi)
  .add(VisitsApi)
  .prefix('/v1')
  .middleware(HttpApiMiddleware.ProblemDetails) {}
