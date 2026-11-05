import { Effect, Layer, Redacted } from 'effect'
import { HttpApiMiddleware, HttpApiSecurity } from 'effect/http-api'
import { Auth, CurrentSession } from './auth.ts'
import { Unauthenticated } from './auth-errors.ts'

/**
 * `Authorization: Bearer <access token>`을 확인하고 `CurrentSession`을 넣는 미들웨어입니다. 토큰이 없거나 틀리면
 * 핸들러를 부르지 않고 401 `UNAUTHENTICATED` Problem Details로 응답합니다.
 */
export class Authentication extends HttpApiMiddleware.Service<Authentication, { provides: CurrentSession }>()(
  'hemr/identity/Authentication',
  { error: Unauthenticated, security: { bearer: HttpApiSecurity.bearer } },
) {}

export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const auth = yield* Auth
    return Authentication.of({
      bearer: (httpEffect, { credential }) =>
        auth
          .authenticate(Redacted.value(credential))
          .pipe(Effect.flatMap((session) => Effect.provideService(httpEffect, CurrentSession, session))),
    })
  }),
)
