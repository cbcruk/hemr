import { Effect } from 'effect'
import { HttpEffect, HttpServerRequest, HttpServerResponse } from 'effect/http'
import { HttpApiBuilder } from 'effect/http-api'
import { Api } from '../../../api.ts'
import { Auth, CurrentSession } from './auth.ts'
import { AuthConfig } from './auth-config.ts'
import type { AuthSettings } from './auth-config.ts'

/** refresh token 쿠키 이름입니다. */
export const REFRESH_COOKIE = 'hemr_refresh'
/** refresh 쿠키는 인증 경로에만 보냅니다. */
const COOKIE_PATH = '/v1/auth'

/** 응답에 refresh 쿠키를 넣습니다(`token`이 `null`이면 지웁니다). 실패 응답에도 붙습니다. */
const setRefreshCookie = (config: AuthSettings, token: string | null) =>
  Effect.gen(function* () {
    const options = { httpOnly: true, secure: config.secureCookie, sameSite: 'strict', path: COOKIE_PATH } as const
    yield* HttpEffect.appendPreResponseHandler((_request, response) =>
      token === null
        ? Effect.succeed(HttpServerResponse.expireCookieUnsafe(response, REFRESH_COOKIE, options))
        : Effect.orDie(
            HttpServerResponse.setCookie(response, REFRESH_COOKIE, token, {
              ...options,
              maxAge: `${config.refreshTtlSeconds} seconds`,
            }),
          ),
    )
  })

/** `Authorization: Bearer`의 토큰입니다. 로그아웃은 쿠키가 없을 때 이것으로 세션을 찾습니다. */
const bearerToken = Effect.map(HttpServerRequest.HttpServerRequest, (request) => {
  const match = /^bearer +(\S+)$/i.exec(request.headers['authorization'] ?? '')
  return match?.[1]
})

const refreshCookie = Effect.map(HttpServerRequest.HttpServerRequest, (request) => request.cookies[REFRESH_COOKIE])

export const AuthHttpLive = HttpApiBuilder.group(
  Api,
  'auth',
  Effect.fn(function* (handlers) {
    const auth = yield* Auth
    const config = yield* AuthConfig
    return handlers.handleAll({
      login: ({ payload }) =>
        Effect.gen(function* () {
          const { refreshToken, ...body } = yield* auth.login(payload)
          yield* setRefreshCookie(config, refreshToken)
          return body
        }),
      refresh: ({ query }) =>
        Effect.gen(function* () {
          const result = yield* auth
            .refresh({ refreshToken: yield* refreshCookie, tenantId: query.tenantId })
            .pipe(Effect.tapError(() => setRefreshCookie(config, null)))
          if (result.refreshToken !== null) yield* setRefreshCookie(config, result.refreshToken)
          return { accessToken: result.accessToken, expiresIn: result.expiresIn, tenantId: result.tenantId }
        }),
      logout: () =>
        Effect.gen(function* () {
          yield* auth.logout({ refreshToken: yield* refreshCookie, accessToken: yield* bearerToken })
          yield* setRefreshCookie(config, null)
        }),
      switchTenant: ({ payload }) =>
        Effect.flatMap(CurrentSession, (session) => auth.switchTenant(session, payload.tenantId)),
    })
  }),
)

export const MeHttpLive = HttpApiBuilder.group(
  Api,
  'me',
  Effect.fn(function* (handlers) {
    const auth = yield* Auth
    return handlers.handle('me', () => Effect.flatMap(CurrentSession, auth.me))
  }),
)
