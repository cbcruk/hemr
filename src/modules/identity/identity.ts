import type { Id } from '../../shared/ids/ids.types.ts'
import { DOCTOR_ROLES, effectivePermissions } from './permissions.ts'
import type { AccessGrant, LicenseType, PatientScope, PermissionGrant, Role } from './permissions.ts'

/** 테넌트가 쓰는 제품입니다 (현행 `서비스연동`). */
export type Product = 'EMR' | 'SOO' | 'INSURANCE' | 'CRM' | 'MEMBERS'

/**
 * 병원입니다. 프로필(상호·대표자 등)은 `TenantProfile`로 따로 둘 예정입니다. 산재기관기호·차트 레이아웃은 쓰는 기능이
 * 생길 때 더합니다.
 */
export interface Tenant {
  id: Id<'tenant'>
  name: string
  /** 요양기관기호입니다. 8자리이고 없을 수 있습니다. */
  hiraInstitutionCode: string | null
  timezone: string
  products: Product[]
  features: string[]
}

/** 사람입니다. 한 사람이 여러 병원에 속할 수 있어 소속은 `Membership`으로 나눕니다. */
export interface User {
  id: Id<'user'>
  /** 로그인 아이디입니다. 전체에서 유일하고, 앞뒤 공백을 빼고 소문자로 저장합니다(`normalizeLoginId`). */
  loginId: string
  name: string
  phone: string | null
  licenseNumber: string | null
  licenseType: LicenseType | null
}

/** 로그인 아이디 비교 키입니다. `Doctor`와 `doctor`를 같은 아이디로 봅니다. */
export const normalizeLoginId = (loginId: string) => loginId.trim().toLowerCase()

/** 병원 소속입니다. 권한은 역할 프리셋과 병원별 조정으로 정해집니다. 직인 이미지는 서명 기능에서 더합니다. */
export interface Membership {
  tenantId: Id<'tenant'>
  userId: Id<'user'>
  role: Role
  /** 현행 `근무형태`입니다. 청구 전송에 필요합니다. */
  employmentType: string | null
  joinedOn: string
  status: 'ACTIVE' | 'DEACTIVATED'
  /** 이 날짜(`YYYY-MM-DD`, 병원 시간대)부터 권한이 없어집니다. */
  deactivatedFrom: string | null
  scope: PatientScope
  grants: PermissionGrant[]
}

/**
 * 소속이 그날 유효한지입니다. 입사일 전이거나, 비활성 상태이거나, 비활성 시작일부터는 유효하지 않습니다. 날짜는
 * 모두 `YYYY-MM-DD`이고 `today`는 병원 시간대의 오늘입니다.
 */
export const isMembershipActive = (membership: Membership, today: string) =>
  membership.status === 'ACTIVE' &&
  membership.joinedOn <= today &&
  (membership.deactivatedFrom === null || today < membership.deactivatedFrom)

/** 소속 저장 검증입니다. 진료의 역할은 근무형태가 있어야 합니다 (청구 전송에 필요). */
export const membershipViolations = (membership: Membership): { field: string; code: string }[] =>
  DOCTOR_ROLES.has(membership.role) && (membership.employmentType ?? '').trim() === ''
    ? [{ field: 'employmentType', code: 'REQUIRED' }]
    : []

/** 사용자가 이 병원에서 그날 할 수 있는 것입니다. 소속이 유효하지 않으면 `null`입니다. */
export function accessGrant(membership: Membership, user: User, today: string): AccessGrant | null {
  if (membership.userId !== user.id || !isMembershipActive(membership, today)) return null
  return {
    permissions: effectivePermissions(membership.role, membership.grants, user.licenseType),
    scope: membership.scope,
    licenseType: user.licenseType,
  }
}
