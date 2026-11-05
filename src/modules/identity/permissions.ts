/**
 * 권한 카탈로그와 계산입니다 (`docs/design/identity-access.md` 권한 모델).
 *
 * 권한은 `resource:action` 문자열입니다. 역할은 권한 묶음 프리셋일 뿐이고, 인가는 계산한 권한 집합으로만
 * 판정합니다. 화면 코드는 권한이 아닙니다.
 */

/**
 * 설정 쓰기 권한의 영역입니다. 현행 설정 권한 코드(`normal_setting` → `normal`)를 그대로 영역 이름으로 씁니다
 * (catalog.md). `members`는 구성원·권한 관리로 새로 둡니다.
 */
export const SETTING_AREAS = [
  'billing',
  'normal',
  'info',
  'record',
  'prescription',
  'template',
  'appointment',
  'caller_number',
  'system',
  'schedule',
  'tablet',
  'message_template',
  'members',
] as const

export type SettingArea = (typeof SETTING_AREAS)[number]

/** 서버가 아는 권한 전체입니다. 여기 없는 권한은 부여할 수 없습니다. 재무(`finance.*`)는 범위가 정해지면 더합니다. */
export const PERMISSIONS = [
  'patient:read',
  'patient:create',
  'patient:update',
  'patient:delete',
  'appointment:read',
  'appointment:create',
  'appointment:update',
  'appointment:cancel',
  'visit:read',
  'visit:check_in',
  'visit:update',
  'visit:cancel',
  'receipt:read',
  'receipt:create',
  'receipt:correct',
  'receipt:void',
  'receipt:refund',
  'encounter:read',
  'encounter:write',
  'encounter:amend',
  'encounter:retract',
  'encounter.home_visit_form:update',
  'prescription:read',
  'prescription:write',
  'prescription:write_prn',
  'procedure:read',
  'procedure:write',
  'herbal_prescription:read',
  'external_herbal_order:read',
  'document:read',
  'document:issue',
  'document:void',
  'signature:sign',
  'claim:read',
  'claim:submit',
  'tax_deduction:read',
  'hira_pre_submission:submit',
  'medical_aid:approve',
  'report:read',
  'crm_program:read',
  'crm_program:update',
  'contact_task:read',
  'contact_task:update',
  'crm_followup:read',
  'message:read',
  'message:send',
  'opt_out:read',
  'opt_out:update',
  'audit_log:read',
  ...SETTING_AREAS.map((area) => `setting.${area}:update` as const),
] as const

export type Permission = (typeof PERMISSIONS)[number]

const KNOWN: ReadonlySet<string> = new Set(PERMISSIONS)

export const isPermission = (value: string): value is Permission => KNOWN.has(value)

/**
 * 면허가 있어야 하는 권한입니다. 권한 설정으로 부여해도 `licenseType`이 맞지 않으면 계산한 집합에서 빠집니다.
 * 진료기록 전자서명은 서명 종류에 따라 다르므로 `canSign`이 따로 봅니다.
 */
export const LICENSED_PERMISSIONS: ReadonlySet<Permission> = new Set([
  'encounter:write',
  'encounter:amend',
  'encounter:retract',
  'prescription:write',
  'prescription:write_prn',
])

export type LicenseType = 'KOREAN_MEDICINE_DOCTOR' | 'PHARMACIST'

/** 면허 권한을 행사할 수 있는 면허입니다. */
const PRACTICING_LICENSES: ReadonlySet<LicenseType> = new Set(['KOREAN_MEDICINE_DOCTOR'])

export const isPracticing = (licenseType: LicenseType | null) =>
  licenseType !== null && PRACTICING_LICENSES.has(licenseType)

export type Role = 'OWNER_DOCTOR' | 'ASSOCIATE_DOCTOR' | 'MANAGER' | 'FRONT_DESK' | 'THERAPIST'

/** 진료의 역할입니다. 소속을 만들 때 `employmentType`이 있어야 합니다 (청구 전송에 필요). */
export const DOCTOR_ROLES: ReadonlySet<Role> = new Set(['OWNER_DOCTOR', 'ASSOCIATE_DOCTOR'])

// 프리셋은 목록으로 직접 적습니다. 카탈로그에 권한을 더해도 프리셋에 저절로 들어가지 않게 하기 위해서입니다
const DESK_READS: Permission[] = [
  'patient:read',
  'appointment:read',
  'visit:read',
  'receipt:read',
  'encounter:read',
  'procedure:read',
  'herbal_prescription:read',
  'document:read',
  'contact_task:read',
  'message:read',
]
const DESK_WORK: Permission[] = [
  'patient:create',
  'patient:update',
  'appointment:create',
  'appointment:update',
  'appointment:cancel',
  'visit:check_in',
  'visit:update',
  'visit:cancel',
  'receipt:create',
  'receipt:correct',
  'receipt:void',
  'receipt:refund',
  'document:issue',
  'signature:sign',
  'message:send',
  'contact_task:update',
]
const CLINICAL_READS: Permission[] = ['prescription:read', 'external_herbal_order:read']
const BACK_OFFICE_READS: Permission[] = [
  'claim:read',
  'tax_deduction:read',
  'crm_program:read',
  'crm_followup:read',
  'opt_out:read',
]
const CLINICAL_WORK: Permission[] = [
  'encounter:write',
  'encounter:amend',
  'encounter:retract',
  'encounter.home_visit_form:update',
  'prescription:write',
  'prescription:write_prn',
  'procedure:write',
]

/**
 * 역할 프리셋의 기본 권한입니다 (identity-access.md 역할 프리셋 기본값). 병원은 `PermissionGrant`로 더하거나 뺍니다.
 * 감사 로그와 구성원 관리는 대표원장만, 매출 리포트는 대표원장과 실장만 가집니다.
 */
export const ROLE_PRESETS: Record<Role, ReadonlySet<Permission>> = {
  OWNER_DOCTOR: new Set(PERMISSIONS),
  ASSOCIATE_DOCTOR: new Set([...DESK_READS, ...CLINICAL_READS, ...BACK_OFFICE_READS, ...DESK_WORK, ...CLINICAL_WORK]),
  MANAGER: new Set([
    ...DESK_READS,
    ...CLINICAL_READS,
    ...BACK_OFFICE_READS,
    ...DESK_WORK,
    'report:read',
    'patient:delete',
    'document:void',
    'claim:submit',
    'hira_pre_submission:submit',
    'medical_aid:approve',
    'crm_program:update',
    'opt_out:update',
    ...SETTING_AREAS.filter((area) => area !== 'members').map((area) => `setting.${area}:update` as const),
  ]),
  FRONT_DESK: new Set([...DESK_READS, ...DESK_WORK]),
  THERAPIST: new Set([
    'patient:read',
    'appointment:read',
    'visit:read',
    'visit:update',
    'encounter:read',
    'procedure:read',
    'procedure:write',
  ]),
}

/** 병원별 조정입니다. `GRANT`는 더하고 `REVOKE`는 뺍니다. 한 권한에 조정은 하나입니다. */
export interface PermissionGrant {
  permission: Permission
  effect: 'GRANT' | 'REVOKE'
}

/**
 * 조정 목록을 저장할 모양으로 맞춥니다. 한 권한에 조정이 여럿이면 하나만 남기고(`REVOKE`가 있으면 `REVOKE`),
 * 권한 이름 순서로 정렬합니다. 막으려던 권한이 실수로 열리지 않게 `REVOKE`를 남깁니다.
 */
export function normalizeGrants(grants: readonly PermissionGrant[]): PermissionGrant[] {
  const byPermission = new Map<Permission, PermissionGrant['effect']>()
  for (const grant of grants) {
    if (byPermission.get(grant.permission) !== 'REVOKE') byPermission.set(grant.permission, grant.effect)
  }
  return [...byPermission]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([permission, effect]) => ({ permission, effect }))
}

/** 환자 데이터 범위입니다. `OWN`은 담당 환자만입니다 (현행 `owner_only`). */
export type PatientScope = 'ALL' | 'OWN'

/** 요청한 사용자가 이 병원에서 할 수 있는 것입니다. */
export interface AccessGrant {
  permissions: ReadonlySet<Permission>
  scope: PatientScope
  /** 권한을 계산한 사용자의 면허입니다. 서명처럼 면허가 판정에 들어가는 곳에서 씁니다. */
  licenseType: LicenseType | null
}

/**
 * 계산한 권한 집합입니다. 프리셋에 조정을 더하고 빼고(같은 권한에 둘 다 있으면 `REVOKE`가 이깁니다), 면허가 맞지
 * 않으면 면허 권한을 뺍니다. 카탈로그에 없는 권한은 무시합니다.
 */
export function effectivePermissions(
  role: Role,
  grants: readonly PermissionGrant[],
  licenseType: LicenseType | null,
): ReadonlySet<Permission> {
  const result = new Set(ROLE_PRESETS[role])
  for (const grant of normalizeGrants(grants.filter((each) => isPermission(each.permission)))) {
    if (grant.effect === 'GRANT') result.add(grant.permission)
    else result.delete(grant.permission)
  }
  if (!isPracticing(licenseType)) {
    for (const permission of LICENSED_PERMISSIONS) result.delete(permission)
  }
  return result
}

/** 전자서명 종류입니다. */
export type SignatureKind = 'MEDICAL_RECORDS' | 'COPAYMENT_LEDGERS'

/** 서명할 수 있는지입니다. 진료기록 서명은 면허가 있어야 하고, 본인부담금 대장 서명은 데스크 업무라 면허가 필요 없습니다. */
export function canSign(access: AccessGrant, kind: SignatureKind): boolean {
  if (!access.permissions.has('signature:sign')) return false
  return kind === 'COPAYMENT_LEDGERS' || isPracticing(access.licenseType)
}
