import { Effect, Layer } from 'effect'
import { newId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { accessGrant } from '../identity.ts'
import type { Membership, Tenant, User } from '../identity.ts'
import { IdentityRepository } from '../identity-repository.ts'
import type { LicenseType, PermissionGrant, Role } from '../permissions.ts'
import type { CurrentAccess } from './access.ts'
import { signAccessToken } from './access-token.ts'
import { TEST_AUTH_SECRET } from './auth-config.ts'
import { AuthRepository } from './auth-repository.ts'

/** 테스트의 기본 병원입니다. */
export const TEST_TENANT: Tenant = {
  id: 'ten_01JBQ000000000000000000001' as Tenant['id'],
  name: '테스트 한의원',
  hiraInstitutionCode: null,
  timezone: 'Asia/Seoul',
  products: ['EMR'],
  features: [],
}

export interface TestMemberOptions {
  role?: Role
  /** 기본은 원장 역할이면 한의사 면허, 아니면 없음입니다. */
  licenseType?: LicenseType | null
  grants?: PermissionGrant[]
  tenant?: Tenant
  /** `false`면 병원을 고르지 않은 토큰입니다. 기본은 `true`입니다. */
  selectTenant?: boolean
  /** 소속에 덮어쓸 값입니다. 예: `{ status: 'DEACTIVATED' }` */
  membership?: Partial<Membership>
}

/**
 * 테스트용 로그인한 구성원입니다. 로그인 API를 거치지 않고 저장소에 병원·사용자·소속·세션을 넣고(`seed`), 테스트 키로
 * access token을 바로 서명합니다(`token`). 서비스를 직접 부르는 테스트는 `access`를 `CurrentAccess`로 넣습니다.
 */
export function testMember(options: TestMemberOptions = {}) {
  const role = options.role ?? 'OWNER_DOCTOR'
  const tenant = options.tenant ?? TEST_TENANT
  const doctor = role === 'OWNER_DOCTOR' || role === 'ASSOCIATE_DOCTOR'
  const userId = newId('user')
  const user: User = {
    id: userId,
    // 한 테스트에 구성원이 여럿이어도 아이디가 겹치지 않게 ID 끝자리를 씁니다
    loginId: `member-${userId.slice(-8).toLowerCase()}`,
    name: '테스트 구성원',
    phone: null,
    licenseNumber: null,
    licenseType: options.licenseType === undefined ? (doctor ? 'KOREAN_MEDICINE_DOCTOR' : null) : options.licenseType,
  }
  const membership: Membership = {
    tenantId: tenant.id,
    userId: user.id,
    role,
    employmentType: doctor ? '상근' : null,
    joinedOn: '2026-01-01',
    status: 'ACTIVE',
    deactivatedFrom: null,
    scope: 'ALL',
    grants: options.grants ?? [],
    ...options.membership,
  }
  const sessionId: Id<'session'> = newId('session')
  const iat = Math.floor(Date.now() / 1000)
  const tid = options.selectTenant === false ? null : tenant.id
  const token = signAccessToken(TEST_AUTH_SECRET, { sub: user.id, sid: sessionId, tid, iat, exp: iat + 600 })
  // 소속이 유효하지 않으면 권한이 없는 것으로 둡니다. 서버는 이 경우 요청을 받지 않습니다
  const grant = accessGrant(membership, user, clinicDate(Date.now())) ?? {
    permissions: new Set(),
    scope: membership.scope,
    licenseType: user.licenseType,
  }
  const access: CurrentAccess['Service'] = { ...grant, userId: user.id, sessionId, tenantId: tenant.id }

  const seed = Layer.effectDiscard(
    Effect.gen(function* () {
      const identity = yield* IdentityRepository
      yield* identity.saveTenant(tenant)
      yield* identity.saveUser(user).pipe(Effect.orDie)
      yield* identity.saveMembership(membership)
      yield* (yield* AuthRepository).createSession(
        { id: sessionId, userId: user.id, tenantId: tid, createdAt: new Date().toISOString(), revokedAt: null },
        { hash: `unused-${sessionId}`, expiresAt: new Date(Date.now() + 60_000).toISOString() },
      )
    }),
  )
  return { user, membership, token, access, seed }
}
