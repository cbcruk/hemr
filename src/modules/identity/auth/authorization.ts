import { Effect, Layer, Option, Redacted } from 'effect'
import { HttpApi, HttpApiMiddleware, HttpApiSecurity } from 'effect/http-api'
import type { HttpApiGroup } from 'effect/http-api'
import { CurrentAccess, accessRuleOf } from './access.ts'
import type { AccessRule } from './access.ts'
import { Auth, CurrentSession } from './auth.ts'
import { PermissionDenied, TenantAccessDenied, TenantNotSelected, Unauthenticated } from './auth-errors.ts'
import { Authentication } from './authentication.ts'

/**
 * 병원 업무 엔드포인트의 권한 미들웨어입니다. access token을 확인하고, 고른 병원의 소속으로 권한을 계산해, 엔드포인트가
 * 선언한 권한(`Access.requires`)을 모두 가졌을 때만 핸들러를 부릅니다. 권한은 토큰에 담지 않고 요청마다 계산하므로
 * 권한을 바꾸면 다음 요청부터 반영됩니다.
 *
 * - 토큰이 없거나 틀림: 401 `UNAUTHENTICATED`
 * - 토큰이 병원을 가리키지 않음: 403 `TENANT_NOT_SELECTED`
 * - 그 병원 소속이 오늘 유효하지 않음: 403 `TENANT_ACCESS_DENIED`
 * - 권한이 모자람: 403 `PERMISSION_DENIED`
 */
export class Authorization extends HttpApiMiddleware.Service<
  Authorization,
  { provides: CurrentSession | CurrentAccess }
>()('hemr/identity/Authorization', {
  error: [Unauthenticated, TenantNotSelected, TenantAccessDenied, PermissionDenied],
  security: { bearer: HttpApiSecurity.bearer },
}) {}

export const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const auth = yield* Auth
    return Authorization.of({
      bearer: (httpEffect, { credential, group, endpoint }) =>
        Effect.gen(function* () {
          const rule = accessRuleOf(group, endpoint)
          // 부팅 검사(`accessViolations`)가 막는 경우지만, 규칙을 못 찾으면 열지 않고 요청을 실패시킵니다
          if (Option.isNone(rule) || rule.value.kind !== 'PERMISSIONS') {
            return yield* Effect.die(new Error(`${group.identifier}.${endpoint.identifier}: no permission rule`))
          }
          const session = yield* auth.authenticate(Redacted.value(credential))
          const access = yield* auth.access(session)
          const missing = rule.value.permissions.filter((each) => !access.permissions.has(each))
          if (missing.length > 0) return yield* new PermissionDenied({ missing })
          return yield* httpEffect.pipe(
            Effect.provideService(CurrentSession, session),
            Effect.provideService(CurrentAccess, access),
          )
        }),
    })
  }),
)

/** 접근 규칙과 미들웨어가 맞지 않는 엔드포인트입니다. */
export interface AccessViolation {
  /** `그룹.엔드포인트`입니다. 예: `visits.cancel` */
  endpoint: string
  problem:
    | 'NOT_DECLARED'
    | 'PUBLIC_WITH_AUTHENTICATION'
    | 'SIGNED_IN_WITHOUT_AUTHENTICATION'
    | 'PERMISSIONS_WITHOUT_AUTHORIZATION'
    | 'AUTHORIZATION_WITHOUT_PERMISSIONS'
}

/**
 * API의 모든 엔드포인트가 접근 규칙을 선언했고, 규칙에 맞는 미들웨어를 달았는지 검사합니다. 서버를 띄울 때 이 검사가
 * 실패하면 뜨지 않습니다. 현행의 "권한 meta를 빠뜨리면 검사를 건너뜀"이 생길 수 없게 하려는 것입니다.
 *
 * 규칙만 선언하고 미들웨어를 빠뜨리면 아무도 규칙을 검사하지 않으므로, 둘이 맞는지도 함께 봅니다.
 */
export function accessViolations<Groups extends HttpApiGroup.Constraint>(
  api: HttpApi.HttpApi<string, Groups>,
): AccessViolation[] {
  const violations: AccessViolation[] = []
  HttpApi.reflect(api, {
    onGroup: () => {},
    onEndpoint: ({ group, endpoint, middleware }) => {
      const name = `${group.identifier}.${endpoint.identifier}`
      // 미들웨어 집합의 원소 타입이 두 미들웨어의 클래스 타입과 맞지 않아 넓혀서 찾습니다
      const keys: ReadonlySet<unknown> = middleware
      const authorizes = keys.has(Authorization)
      const authenticates = authorizes || keys.has(Authentication)
      const problem = violationOf(accessRuleOf(group, endpoint), authenticates, authorizes)
      if (problem !== null) violations.push({ endpoint: name, problem })
    },
  })
  return violations
}

/**
 * `accessViolations`가 하나라도 있으면 만들어지지 않는 Layer입니다. 앱 Layer에 넣어 서버가 뜨지 않게 합니다. 검사하지
 * 않은 엔드포인트가 열린 채로 배포되는 것보다 뜨지 않는 편이 낫습니다.
 */
export const accessCheck = <Groups extends HttpApiGroup.Constraint>(api: HttpApi.HttpApi<string, Groups>) =>
  Layer.effectDiscard(
    Effect.suspend(() => {
      const violations = accessViolations(api)
      if (violations.length === 0) return Effect.void
      const list = violations.map((each) => `${each.endpoint} ${each.problem}`).join(', ')
      return Effect.die(new Error(`endpoint access rules are invalid: ${list}`))
    }),
  )

function violationOf(
  rule: Option.Option<AccessRule>,
  authenticates: boolean,
  authorizes: boolean,
): AccessViolation['problem'] | null {
  if (Option.isNone(rule)) return 'NOT_DECLARED'
  switch (rule.value.kind) {
    case 'PUBLIC':
      return authenticates ? 'PUBLIC_WITH_AUTHENTICATION' : null
    case 'SIGNED_IN':
      if (authorizes) return 'AUTHORIZATION_WITHOUT_PERMISSIONS'
      return authenticates ? null : 'SIGNED_IN_WITHOUT_AUTHENTICATION'
    case 'PERMISSIONS':
      return authorizes ? null : 'PERMISSIONS_WITHOUT_AUTHORIZATION'
  }
}
