import { Context, Effect, Option } from 'effect'
import type { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { AccessGrant, Permission } from '../permissions.ts'
import { PermissionDenied } from './auth-errors.ts'

/**
 * 엔드포인트가 선언하는 접근 규칙입니다 (identity-access.md 권한 모델).
 *
 * - `PUBLIC`: 로그인 없이 부릅니다. 상태 확인과 로그인·refresh·로그아웃만 씁니다
 * - `SIGNED_IN`: 로그인만 필요하고 병원은 고르지 않아도 됩니다. `/me`와 병원 전환처럼 병원을 고르기 전에 쓰는 곳입니다
 * - `PERMISSIONS`: 고른 병원에서 나열한 권한을 모두 가져야 합니다. 병원 업무 엔드포인트는 모두 이것입니다
 */
export type AccessRule =
  | { readonly kind: 'PUBLIC' }
  | { readonly kind: 'SIGNED_IN' }
  | { readonly kind: 'PERMISSIONS'; readonly permissions: ReadonlyArray<Permission> }

/**
 * 접근 규칙 annotation입니다. 엔드포인트마다 `.annotate(Access, Access.requires('visit:update'))`처럼 붙입니다. 붙이지
 * 않은 엔드포인트가 있으면 서버가 뜨지 않습니다(`accessViolations`).
 */
export class Access extends Context.Service<Access, AccessRule>()('hemr/identity/Access') {
  static readonly public: AccessRule = { kind: 'PUBLIC' }
  static readonly signedIn: AccessRule = { kind: 'SIGNED_IN' }
  static requires(...permissions: [Permission, ...Permission[]]): AccessRule {
    return { kind: 'PERMISSIONS', permissions }
  }
}

/** 엔드포인트의 접근 규칙입니다. 그룹에 붙인 규칙보다 엔드포인트에 붙인 규칙이 이깁니다. */
export function accessRuleOf(group: HttpApiGroup.Top, endpoint: HttpApiEndpoint.Top): Option.Option<AccessRule> {
  return Context.getOption(Context.merge(group.annotations, endpoint.annotations), Access)
}

/** 권한 미들웨어가 요청에 넣는, 고른 병원에서의 현재 사용자 권한입니다. */
export class CurrentAccess extends Context.Service<
  CurrentAccess,
  AccessGrant & { userId: Id<'user'>; sessionId: Id<'session'>; tenantId: Id<'tenant'> }
>()('hemr/identity/CurrentAccess') {}

/**
 * 현재 사용자가 `permissions`를 모두 가졌는지 확인합니다. 엔드포인트 선언만으로 정할 수 없는 권한, 예를 들어 본문에 따라
 * 더 필요한 권한(연쇄 취소)에 씁니다.
 */
export const requirePermissions = (
  ...permissions: [Permission, ...Permission[]]
): Effect.Effect<void, PermissionDenied, CurrentAccess> =>
  Effect.gen(function* () {
    const access = yield* CurrentAccess
    const missing = permissions.filter((each) => !access.permissions.has(each))
    if (missing.length > 0) return yield* new PermissionDenied({ missing })
  })
