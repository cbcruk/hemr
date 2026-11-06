import { Clock, Context, Effect, Layer, Option } from 'effect'
import { newId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { accessGrant, isMembershipActive, normalizeLoginId } from '../identity.ts'
import type { Product, User } from '../identity.ts'
import { IdentityRepository } from '../identity-repository.ts'
import type { LicenseType, PatientScope, Permission, Role } from '../permissions.ts'
import { signAccessToken, verifyAccessToken } from './access-token.ts'
import { AuthConfig } from './auth-config.ts'
import type { CurrentAccess } from './access.ts'
import {
  AccountLocked,
  InvalidCredentials,
  TenantAccessDenied,
  TenantNotSelected,
  Unauthenticated,
} from './auth-errors.ts'
import { AuthRepository } from './auth-repository.ts'
import { DUMMY_PASSWORD_HASH, verifyPassword } from './password.ts'
import { newRefreshToken, refreshTokenHash } from './refresh-token.ts'
import { SecurityLog } from './security-log.ts'
import type { SecurityEvent } from './security-log.ts'

/** 인증 미들웨어가 요청에 넣는 현재 세션입니다. */
export class CurrentSession extends Context.Service<
  CurrentSession,
  { userId: Id<'user'>; sessionId: Id<'session'>; tenantId: Id<'tenant'> | null }
>()('hemr/identity/CurrentSession') {}

export interface IssuedAccessToken {
  accessToken: string
  /** access token 수명(초)입니다. */
  expiresIn: number
}

/** 로그인한 사용자가 고를 수 있는 병원입니다. */
export interface MembershipSummary {
  tenantId: Id<'tenant'>
  tenantName: string
  role: Role
}

export interface UserSummary {
  id: Id<'user'>
  loginId: string
  name: string
  licenseType: LicenseType | null
}

export interface LoginResult extends IssuedAccessToken {
  /** 쿠키로만 내보냅니다. 응답 본문에 넣지 않습니다. */
  refreshToken: string
  user: UserSummary
  memberships: MembershipSummary[]
  /** 소속이 하나면 그 병원이고, 여럿이거나 없으면 `null`입니다. */
  tenantId: Id<'tenant'> | null
}

export interface RefreshResult extends IssuedAccessToken {
  /** 새 access token이 가리키는 병원입니다. */
  tenantId: Id<'tenant'> | null
  /** 새 refresh token입니다. 동시 refresh(유예 시간 안)면 이미 다른 응답이 쿠키를 바꿨으므로 `null`입니다. */
  refreshToken: string | null
}

/** `GET /me` 응답입니다. 고른 병원의 소속이 유효하지 않으면 `tenant`가 `null`이고 권한이 없습니다. */
export interface Me {
  user: UserSummary
  memberships: MembershipSummary[]
  tenant: { id: Id<'tenant'>; name: string; products: Product[]; features: string[] } | null
  role: Role | null
  scope: PatientScope | null
  permissions: Permission[]
}

/**
 * 로그인 세션입니다 (identity-access.md 로그인과 세션). access token은 짧은 HS256 JWT이고, refresh token은 회전하며
 * 이미 쓴 토큰이 다시 오면 그 세션을 폐기합니다. 권한은 토큰에 담지 않고 요청마다 계산해, 권한 변경이 바로
 * 반영됩니다.
 */
export class Auth extends Context.Service<
  Auth,
  {
    login(input: { loginId: string; password: string }): Effect.Effect<LoginResult, InvalidCredentials | AccountLocked>
    /**
     * 새 access token을 줍니다. `tenantId`는 클라이언트(탭)가 보고 있던 병원입니다. 주면 그 병원으로, 안 주면 세션에
     * 남은 병원으로 줍니다. 그 병원 소속이 오늘 유효하지 않으면 병원 없이(`null`) 줍니다. 회전한 뒤에 실패하면 새
     * 쿠키를 잃으므로 병원 때문에 실패하지 않습니다.
     */
    refresh(input: {
      refreshToken: string | undefined
      tenantId?: Id<'tenant'> | undefined
    }): Effect.Effect<RefreshResult, Unauthenticated>
    /**
     * 세션을 폐기합니다. refresh token으로 찾고, 쿠키가 없으면 access token의 세션을 폐기합니다. 둘 다 없거나 이미
     * 폐기됐어도 성공입니다.
     */
    logout(input: { refreshToken: string | undefined; accessToken: string | undefined }): Effect.Effect<void>
    /** access token을 확인합니다. 서명·만료와 함께 세션이 폐기되지 않았는지 봅니다. */
    authenticate(accessToken: string): Effect.Effect<CurrentSession['Service'], Unauthenticated>
    switchTenant(
      session: CurrentSession['Service'],
      tenantId: Id<'tenant'>,
    ): Effect.Effect<IssuedAccessToken, TenantAccessDenied>
    me(session: CurrentSession['Service']): Effect.Effect<Me, Unauthenticated>
    /** 세션이 고른 병원에서의 오늘 권한입니다. 권한 미들웨어(`Authorization`)가 요청마다 부릅니다. */
    access(
      session: CurrentSession['Service'],
    ): Effect.Effect<CurrentAccess['Service'], Unauthenticated | TenantNotSelected | TenantAccessDenied>
  }
>()('hemr/identity/Auth') {
  static readonly layer = Layer.effect(
    Auth,
    Effect.gen(function* () {
      const config = yield* AuthConfig
      const identity = yield* IdentityRepository
      const store = yield* AuthRepository
      const log = yield* SecurityLog

      const record = (event: Partial<SecurityEvent> & Pick<SecurityEvent, 'type' | 'time'>) =>
        log.record({ loginId: null, userId: null, tenantId: null, sessionId: null, detail: null, ...event })

      const issue = (userId: Id<'user'>, sessionId: Id<'session'>, tenantId: Id<'tenant'> | null, now: number) => {
        const iat = Math.floor(now / 1000)
        const claims = { sub: userId, sid: sessionId, tid: tenantId, iat, exp: iat + config.accessTtlSeconds }
        return { accessToken: signAccessToken(config.secret, claims), expiresIn: config.accessTtlSeconds }
      }
      const nextRefresh = (now: number) => {
        const token = newRefreshToken()
        const expiresAt = new Date(now + config.refreshTtlSeconds * 1000).toISOString()
        return { token, record: { hash: refreshTokenHash(token), expiresAt } }
      }

      const summary = (user: User): UserSummary => ({
        id: user.id,
        loginId: user.loginId,
        name: user.name,
        licenseType: user.licenseType,
      })
      /** 오늘 유효한 소속을 병원 이름과 함께 돌려줍니다. 병원이 없으면 뺍니다. */
      const activeMemberships = (userId: Id<'user'>, today: string) =>
        identity.membershipsOf(userId).pipe(
          Effect.flatMap((all) =>
            Effect.forEach(
              all.filter((each) => isMembershipActive(each, today)),
              (each) =>
                identity.findTenant(each.tenantId).pipe(
                  Effect.map(
                    Option.map((tenant): MembershipSummary => ({
                      tenantId: tenant.id,
                      tenantName: tenant.name,
                      role: each.role,
                    })),
                  ),
                ),
            ),
          ),
          Effect.map(Option.reduceCompact([] as MembershipSummary[], (all, each) => [...all, each])),
        )

      const login = Effect.fn('Auth.login')(function* (input: { loginId: string; password: string }) {
        const now = yield* Clock.currentTimeMillis
        const time = new Date(now).toISOString()
        const loginId = normalizeLoginId(input.loginId)
        const failed = (detail: string, userId: Id<'user'> | null = null) =>
          record({ type: 'LOGIN_FAILED', time, loginId, userId, detail })

        const user = yield* identity.findUserByLoginId(loginId)
        const credential = Option.isSome(user) ? yield* store.findCredential(user.value.id) : Option.none()
        if (Option.isNone(user) || Option.isNone(credential)) {
          // 아이디가 있을 때와 걸리는 시간을 맞춥니다
          yield* verifyPassword(input.password, DUMMY_PASSWORD_HASH)
          yield* failed(
            Option.isNone(user) ? 'UNKNOWN_LOGIN_ID' : 'NO_PASSWORD',
            Option.getOrNull(Option.map(user, (u) => u.id)),
          )
          return yield* new InvalidCredentials({})
        }
        const userId = user.value.id
        if (credential.value.lockedAt !== null) {
          yield* failed('LOCKED', userId)
          return yield* new AccountLocked({})
        }
        if (!(yield* verifyPassword(input.password, credential.value.passwordHash))) {
          const after = yield* store.recordFailedLogin(userId, time, config.lockAfterFailures)
          yield* failed('PASSWORD_MISMATCH', userId)
          if (Option.isSome(after) && after.value.lockedAt !== null) {
            // 이번 실패로 잠갔으면 이미 있는 세션도 끝냅니다. 잠긴 계정의 세션이 refresh로 이어지지 않게 합니다
            if (after.value.lockedAt === time) {
              yield* store.revokeSessionsOf(userId, time)
              yield* record({ type: 'ACCOUNT_LOCKED', time, loginId, userId })
            }
            return yield* new AccountLocked({})
          }
          return yield* new InvalidCredentials({})
        }
        // 검증하는 동안 동시에 들어온 실패가 계정을 잠갔을 수 있어 잠금을 다시 확인합니다
        if (!(yield* store.completeLogin(userId))) {
          yield* failed('LOCKED', userId)
          return yield* new AccountLocked({})
        }

        const memberships = yield* activeMemberships(userId, clinicDate(now))
        const tenantId = memberships.length === 1 ? memberships[0]!.tenantId : null
        const sessionId = newId('session', now)
        const refresh = nextRefresh(now)
        yield* store.createSession(
          { id: sessionId, userId, tenantId, createdAt: time, revokedAt: null },
          refresh.record,
        )
        yield* record({ type: 'LOGIN_SUCCEEDED', time, loginId, userId, tenantId, sessionId })
        return {
          ...issue(userId, sessionId, tenantId, now),
          refreshToken: refresh.token,
          user: summary(user.value),
          memberships,
          tenantId,
        }
      })

      /** 사용자가 오늘 그 병원에 유효한 소속이 있으면 그 병원, 없으면 `null`입니다. */
      const activeTenant = (userId: Id<'user'>, tenantId: Id<'tenant'> | null, now: number) =>
        tenantId === null
          ? Effect.succeed(null)
          : identity
              .findMembership(tenantId, userId)
              .pipe(
                Effect.map((membership) =>
                  Option.isSome(membership) && isMembershipActive(membership.value, clinicDate(now)) ? tenantId : null,
                ),
              )

      const refresh = Effect.fn('Auth.refresh')(function* (input: {
        refreshToken: string | undefined
        tenantId?: Id<'tenant'> | undefined
      }) {
        const presented = input.refreshToken
        if (presented === undefined || presented === '') return yield* new Unauthenticated({})
        const now = yield* Clock.currentTimeMillis
        const time = new Date(now).toISOString()
        const next = nextRefresh(now)
        const result = yield* store.rotateRefreshToken({
          presented: refreshTokenHash(presented),
          next: next.record,
          now: time,
          graceFrom: new Date(now - config.refreshGraceSeconds * 1000).toISOString(),
        })
        switch (result._tag) {
          case 'Invalid':
            return yield* new Unauthenticated({})
          case 'Reused':
            yield* record({
              type: 'REFRESH_TOKEN_REUSED',
              time,
              userId: result.session.userId,
              tenantId: result.session.tenantId,
              sessionId: result.session.id,
            })
            return yield* new Unauthenticated({})
          case 'Concurrent':
          case 'Rotated': {
            const { userId, id, tenantId } = result.session
            const tenant = yield* activeTenant(userId, input.tenantId ?? tenantId, now)
            return {
              ...issue(userId, id, tenant, now),
              tenantId: tenant,
              refreshToken: result._tag === 'Rotated' ? next.token : null,
            }
          }
        }
      })

      const logout = Effect.fn('Auth.logout')(function* (input: {
        refreshToken: string | undefined
        accessToken: string | undefined
      }) {
        const now = yield* Clock.currentTimeMillis
        const time = new Date(now).toISOString()
        const { refreshToken, accessToken } = input
        const claims = accessToken === undefined ? Option.none() : verifyAccessToken(config.secret, accessToken, now)
        const revoked =
          refreshToken !== undefined && refreshToken !== ''
            ? yield* store.revokeByRefreshToken(refreshTokenHash(refreshToken), time)
            : Option.isSome(claims)
              ? yield* store.revokeSession(claims.value.sid, time)
              : Option.none()
        if (Option.isSome(revoked)) {
          const session = revoked.value
          yield* record({
            type: 'LOGGED_OUT',
            time,
            userId: session.userId,
            tenantId: session.tenantId,
            sessionId: session.id,
          })
        }
      })

      const authenticate = Effect.fn('Auth.authenticate')(function* (accessToken: string) {
        const claims = verifyAccessToken(config.secret, accessToken, yield* Clock.currentTimeMillis)
        if (Option.isNone(claims)) return yield* new Unauthenticated({})
        const session = yield* store.findSession(claims.value.sid)
        if (Option.isNone(session) || session.value.revokedAt !== null || session.value.userId !== claims.value.sub) {
          return yield* new Unauthenticated({})
        }
        return { userId: claims.value.sub, sessionId: claims.value.sid, tenantId: claims.value.tid }
      })

      const switchTenant = Effect.fn('Auth.switchTenant')(function* (
        current: CurrentSession['Service'],
        tenantId: Id<'tenant'>,
      ) {
        const now = yield* Clock.currentTimeMillis
        const membership = yield* identity.findMembership(tenantId, current.userId)
        const tenant = yield* identity.findTenant(tenantId)
        if (
          Option.isNone(membership) ||
          Option.isNone(tenant) ||
          !isMembershipActive(membership.value, clinicDate(now))
        ) {
          return yield* new TenantAccessDenied({})
        }
        yield* store.switchTenant(current.sessionId, tenantId)
        yield* record({
          type: 'TENANT_SWITCHED',
          time: new Date(now).toISOString(),
          userId: current.userId,
          tenantId,
          sessionId: current.sessionId,
        })
        return issue(current.userId, current.sessionId, tenantId, now)
      })

      const me = Effect.fn('Auth.me')(function* (current: CurrentSession['Service']) {
        const now = yield* Clock.currentTimeMillis
        const today = clinicDate(now)
        const user = yield* identity.findUser(current.userId)
        if (Option.isNone(user)) return yield* new Unauthenticated({})
        const memberships = yield* activeMemberships(current.userId, today)
        const none: Me = {
          user: summary(user.value),
          memberships,
          tenant: null,
          role: null,
          scope: null,
          permissions: [],
        }
        if (current.tenantId === null) return none
        const membership = yield* identity.findMembership(current.tenantId, current.userId)
        const tenant = yield* identity.findTenant(current.tenantId)
        const grant = Option.isSome(membership) ? accessGrant(membership.value, user.value, today) : null
        if (grant === null || Option.isNone(membership) || Option.isNone(tenant)) return none
        const { id, name, products, features } = tenant.value
        return {
          ...none,
          tenant: { id, name, products, features },
          role: membership.value.role,
          scope: grant.scope,
          permissions: [...grant.permissions].sort(),
        }
      })

      const access = Effect.fn('Auth.access')(function* (current: CurrentSession['Service']) {
        const tenantId = current.tenantId
        if (tenantId === null) return yield* new TenantNotSelected({})
        const today = clinicDate(yield* Clock.currentTimeMillis)
        // 사용자가 없어졌으면 `/me`처럼 401이고, 병원이 없어졌거나 소속이 유효하지 않으면 403입니다
        const user = yield* identity.findUser(current.userId)
        if (Option.isNone(user)) return yield* new Unauthenticated({})
        const membership = yield* identity.findMembership(tenantId, current.userId)
        const tenant = yield* identity.findTenant(tenantId)
        const grant =
          Option.isSome(membership) && Option.isSome(tenant) ? accessGrant(membership.value, user.value, today) : null
        if (grant === null) return yield* new TenantAccessDenied({})
        return { ...grant, userId: current.userId, sessionId: current.sessionId, tenantId }
      })

      return Auth.of({ login, refresh, logout, authenticate, switchTenant, me, access })
    }),
  )
}
