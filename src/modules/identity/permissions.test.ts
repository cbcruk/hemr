import { describe, expect, it } from 'vitest'
import {
  LICENSED_PERMISSIONS,
  PERMISSIONS,
  ROLE_PRESETS,
  SETTING_AREAS,
  canSign,
  effectivePermissions,
  isPermission,
  normalizeGrants,
} from './permissions.ts'
import type { Permission, PermissionGrant, Role } from './permissions.ts'

const ROLES = Object.keys(ROLE_PRESETS) as Role[]

describe('ROLE_PRESETS', () => {
  it('only uses permissions from the catalog', () => {
    for (const role of ROLES) for (const permission of ROLE_PRESETS[role]) expect(isPermission(permission)).toBe(true)
    expect(isPermission('chart_create')).toBe(false)
  })

  it('gives the owner everything and keeps the audit log to the owner', () => {
    expect(ROLE_PRESETS.OWNER_DOCTOR.size).toBe(PERMISSIONS.length)
    expect(ROLES.filter((role) => ROLE_PRESETS[role].has('audit_log:read'))).toEqual(['OWNER_DOCTOR'])
  })

  it('gives licensed permissions only to doctor presets', () => {
    for (const permission of LICENSED_PERMISSIONS) {
      expect(ROLES.filter((role) => ROLE_PRESETS[role].has(permission))).toEqual(['OWNER_DOCTOR', 'ASSOCIATE_DOCTOR'])
    }
  })
})

describe('effectivePermissions', () => {
  it('adds grants and lets a revoke win over a grant', () => {
    const result = effectivePermissions(
      'FRONT_DESK',
      [
        { permission: 'claim:read', effect: 'GRANT' },
        { permission: 'receipt:refund', effect: 'REVOKE' },
        { permission: 'report:read', effect: 'GRANT' },
        { permission: 'report:read', effect: 'REVOKE' },
      ],
      null,
    )
    expect(result.has('claim:read')).toBe(true)
    expect(result.has('receipt:refund')).toBe(false)
    expect(result.has('report:read')).toBe(false)
  })

  it('drops licensed permissions without a practicing license, even when granted', () => {
    const granted = effectivePermissions('FRONT_DESK', [{ permission: 'prescription:write', effect: 'GRANT' }], null)
    expect(granted.has('prescription:write')).toBe(false)
    expect(effectivePermissions('OWNER_DOCTOR', [], 'PHARMACIST').has('encounter:write')).toBe(false)
    expect(effectivePermissions('ASSOCIATE_DOCTOR', [], 'KOREAN_MEDICINE_DOCTOR').has('encounter:write')).toBe(true)
    const unlicensedOwner = effectivePermissions('OWNER_DOCTOR', [], null)
    expect([...LICENSED_PERMISSIONS].filter((each) => unlicensedOwner.has(each))).toEqual([])
    expect(unlicensedOwner.has('audit_log:read')).toBe(true)
  })

  it('ignores a permission that is no longer in the catalog', () => {
    const stale = [{ permission: 'chart_create', effect: 'GRANT' }] as unknown as PermissionGrant[]
    expect(effectivePermissions('THERAPIST', stale, null)).toEqual(ROLE_PRESETS.THERAPIST)
  })
})

describe('canSign', () => {
  const desk = { permissions: ROLE_PRESETS.FRONT_DESK, scope: 'ALL' as const, licenseType: null }
  const doctor = { ...desk, licenseType: 'KOREAN_MEDICINE_DOCTOR' as const }

  it('needs a license only for medical records', () => {
    expect(canSign(desk, 'COPAYMENT_LEDGERS')).toBe(true)
    expect(canSign(desk, 'MEDICAL_RECORDS')).toBe(false)
    expect(canSign(doctor, 'MEDICAL_RECORDS')).toBe(true)
  })

  it('needs signature:sign even with a license', () => {
    expect(canSign({ ...doctor, permissions: new Set() }, 'COPAYMENT_LEDGERS')).toBe(false)
    expect(canSign({ ...doctor, permissions: new Set() }, 'MEDICAL_RECORDS')).toBe(false)
  })
})

describe('normalizeGrants', () => {
  it('keeps one adjustment per permission, revoke first, sorted by name', () => {
    expect(
      normalizeGrants([
        { permission: 'report:read', effect: 'REVOKE' },
        { permission: 'claim:read', effect: 'GRANT' },
        { permission: 'report:read', effect: 'GRANT' },
        { permission: 'claim:read', effect: 'GRANT' },
      ]),
    ).toEqual([
      { permission: 'claim:read', effect: 'GRANT' },
      { permission: 'report:read', effect: 'REVOKE' },
    ])
  })
})

describe('preset contents', () => {
  // 프리셋을 바꾸면 이 목록도 함께 고쳐, 권한 변경이 의도한 것인지 리뷰에서 드러나게 합니다
  it.each(Object.entries(PRESET_SNAPSHOT))('%s', (role, expected) => {
    expect([...ROLE_PRESETS[role as Role]].sort()).toEqual([...expected].sort())
  })

  it('leaves revenue to the owner and manager, members and audit log to the owner', () => {
    expect(ROLES.filter((role) => ROLE_PRESETS[role].has('report:read'))).toEqual(['OWNER_DOCTOR', 'MANAGER'])
    expect(ROLES.filter((role) => ROLE_PRESETS[role].has('setting.members:update'))).toEqual(['OWNER_DOCTOR'])
  })

  it('lets only doctors cancel in cascade (D3)', () => {
    const cascade = ['visit:cancel', 'receipt:void', 'encounter:retract'] as const
    expect(ROLES.filter((role) => cascade.every((each) => ROLE_PRESETS[role].has(each)))).toEqual([
      'OWNER_DOCTOR',
      'ASSOCIATE_DOCTOR',
    ])
  })
})

const DESK_READS: Permission[] = [
  'patient:read',
  'patient.rrn:read',
  'appointment:read',
  'visit:read',
  'receipt:read',
  'cash_drawer:read',
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
  'cash_drawer:update',
  'encounter.amendment_proposal:create',
  'document:issue',
  'signature:sign',
  'message:send',
  'contact_task:update',
]
const OFFICE_READS: Permission[] = [
  'prescription:read',
  'external_herbal_order:read',
  'claim:read',
  'tax_deduction:read',
  'crm_program:read',
  'crm_followup:read',
  'opt_out:read',
]

const PRESET_SNAPSHOT: Record<Exclude<Role, 'OWNER_DOCTOR'>, Permission[]> = {
  ASSOCIATE_DOCTOR: [
    ...DESK_READS,
    ...DESK_WORK,
    ...OFFICE_READS,
    'encounter:write',
    'encounter:amend',
    'encounter:retract',
    'encounter.home_visit_form:update',
    'prescription:write',
    'prescription:write_prn',
    'procedure:write',
  ],
  MANAGER: [
    ...DESK_READS,
    ...DESK_WORK,
    ...OFFICE_READS,
    'report:read',
    'patient:delete',
    'document:void',
    'claim:submit',
    'hira_pre_submission:submit',
    'medical_aid:approve',
    'crm_program:update',
    'opt_out:update',
    ...SETTING_AREAS.filter((area) => area !== 'members').map((area) => `setting.${area}:update` as Permission),
  ],
  FRONT_DESK: [...DESK_READS, ...DESK_WORK],
  THERAPIST: [
    'patient:read',
    'appointment:read',
    'visit:read',
    'visit:update',
    'encounter:read',
    'procedure:read',
    'procedure:write',
  ],
}
