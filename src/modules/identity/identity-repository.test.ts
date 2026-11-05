import { Effect, Exit, Layer, Option } from 'effect'
import { SqlClient } from 'effect/sql'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../persistence.ts'
import { accessGrant, isMembershipActive, membershipViolations } from './identity.ts'
import type { Membership, Tenant, User } from './identity.ts'
import { IdentityRepository } from './identity-repository.ts'

const tenant: Tenant = {
  id: 'ten_01JBQ000000000000000000001' as Tenant['id'],
  name: 'A한의원',
  hiraInstitutionCode: '12345678',
  timezone: 'Asia/Seoul',
  products: ['EMR', 'CRM'],
  features: ['telemedicine'],
}
const doctor: User = {
  id: 'usr_01JBQ000000000000000000001' as User['id'],
  loginId: 'doctor',
  name: '김원장',
  phone: null,
  licenseNumber: '12345',
  licenseType: 'KOREAN_MEDICINE_DOCTOR',
}
const desk: User = { ...doctor, id: 'usr_01JBQ000000000000000000002' as User['id'], loginId: 'desk', licenseType: null }
const membership: Membership = {
  tenantId: tenant.id,
  userId: doctor.id,
  role: 'ASSOCIATE_DOCTOR',
  employmentType: '상근',
  joinedOn: '2026-01-01',
  status: 'ACTIVE',
  deactivatedFrom: null,
  scope: 'OWN',
  grants: [{ permission: 'audit_log:read', effect: 'GRANT' }],
}

const run = <A, E, R extends IdentityRepository | SqlClient.SqlClient>(
  layer: Layer.Layer<R, unknown>,
  program: Effect.Effect<A, E, R>,
) => Effect.runPromise(program.pipe(Effect.provide(layer)))

describe.each([
  ['memory', () => PersistenceMemory()],
  ['sqlite', () => PersistenceSqlite(':memory:')],
] as const)('IdentityRepository (%s)', (_, layer) => {
  it('stores tenants, users and memberships with their grants', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* IdentityRepository
        yield* repository.saveTenant(tenant)
        yield* repository.saveUser(doctor)
        yield* repository.saveMembership(membership)
        return {
          tenant: yield* repository.findTenant(tenant.id),
          byLogin: yield* repository.findUserByLoginId('doctor'),
          membership: yield* repository.findMembership(tenant.id, doctor.id),
          missing: yield* repository.findMembership(tenant.id, desk.id),
        }
      }),
    )
    expect(result.tenant).toEqual(Option.some(tenant))
    expect(result.byLogin).toEqual(Option.some(doctor))
    expect(result.membership).toEqual(Option.some(membership))
    expect(Option.isNone(result.missing)).toBe(true)
  })

  it('replaces grants on save and lists memberships of a user', async () => {
    const other: Tenant = { ...tenant, id: 'ten_01JBQ000000000000000000002' as Tenant['id'], hiraInstitutionCode: null }
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* IdentityRepository
        yield* repository.saveTenant(other)
        yield* repository.saveTenant(tenant)
        yield* repository.saveUser(doctor)
        yield* repository.saveMembership({ ...membership, tenantId: other.id, role: 'OWNER_DOCTOR', grants: [] })
        yield* repository.saveMembership(membership)
        yield* repository.saveMembership({
          ...membership,
          grants: [
            { permission: 'report:read', effect: 'GRANT' },
            { permission: 'claim:submit', effect: 'GRANT' },
            { permission: 'report:read', effect: 'REVOKE' },
          ],
        })
        return yield* repository.membershipsOf(doctor.id)
      }),
    )
    expect(result.map((each) => [each.tenantId, each.role, each.grants])).toEqual([
      [
        tenant.id,
        'ASSOCIATE_DOCTOR',
        [
          { permission: 'claim:submit', effect: 'GRANT' },
          { permission: 'report:read', effect: 'REVOKE' },
        ],
      ],
      [other.id, 'OWNER_DOCTOR', []],
    ])
  })

  it('keeps login ids unique across users', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* IdentityRepository
        yield* repository.saveUser(doctor)
        yield* repository.saveUser({ ...doctor, name: '이름 변경' })
        const clash = yield* Effect.flip(repository.saveUser({ ...desk, loginId: ' Doctor ' }))
        yield* repository.saveUser(desk)
        const rename = yield* Effect.flip(repository.saveUser({ ...desk, loginId: 'DOCTOR' }))
        return {
          clash,
          rename,
          found: yield* repository.findUser(doctor.id),
          byLogin: yield* repository.findUserByLoginId(' DOCTOR'),
          desk: yield* repository.findUser(desk.id),
        }
      }),
    )
    expect(result.clash).toMatchObject({ _tag: 'LoginIdTaken', loginId: 'doctor' })
    expect(result.rename).toMatchObject({ _tag: 'LoginIdTaken', loginId: 'doctor' })
    expect(Option.getOrThrow(result.found).name).toBe('이름 변경')
    expect(Option.getOrThrow(result.byLogin).id).toBe(doctor.id)
    expect(Option.getOrThrow(result.desk).loginId).toBe('desk')
  })

  it('does not share saved objects with the caller', async () => {
    const found = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* IdentityRepository
        yield* repository.saveTenant(tenant)
        yield* repository.saveUser(doctor)
        const saved = { ...membership, grants: [...membership.grants] }
        yield* repository.saveMembership(saved)
        saved.grants.push({ permission: 'claim:submit', effect: 'GRANT' })
        return yield* repository.findMembership(tenant.id, doctor.id)
      }),
    )
    expect(Option.getOrThrow(found).grants).toEqual(membership.grants)
  })
})

describe('IdentityRepository (sqlite) constraints', () => {
  it('rejects a membership for an unknown tenant', async () => {
    const exit = await run(
      PersistenceSqlite(':memory:'),
      Effect.gen(function* () {
        const repository = yield* IdentityRepository
        yield* repository.saveUser(doctor)
        return yield* Effect.exit(repository.saveMembership(membership))
      }),
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('rejects a membership for an unknown user or a doctor without employment type', async () => {
    const result = await run(
      PersistenceSqlite(':memory:'),
      Effect.gen(function* () {
        const repository = yield* IdentityRepository
        yield* repository.saveTenant(tenant)
        const unknownUser = yield* Effect.exit(repository.saveMembership(membership))
        yield* repository.saveUser(doctor)
        const noEmployment = yield* Effect.exit(repository.saveMembership({ ...membership, employmentType: null }))
        return { unknownUser, noEmployment }
      }),
    )
    expect(Exit.isFailure(result.unknownUser)).toBe(true)
    expect(Exit.isFailure(result.noEmployment)).toBe(true)
  })

  it('drops grants for permissions that left the catalog', async () => {
    const found = await run(
      PersistenceSqlite(':memory:'),
      Effect.gen(function* () {
        const repository = yield* IdentityRepository
        yield* repository.saveTenant(tenant)
        yield* repository.saveUser(doctor)
        yield* repository.saveMembership(membership)
        const sql = yield* SqlClient.SqlClient
        yield* sql`INSERT INTO permission_grants VALUES (${tenant.id}, ${doctor.id}, 'chart_create', 'GRANT')`
        return yield* repository.findMembership(tenant.id, doctor.id)
      }),
    )
    expect(Option.getOrThrow(found).grants).toEqual(membership.grants)
  })
})

describe('accessGrant', () => {
  it('computes permissions with the user license and the membership scope', () => {
    const grant = accessGrant(membership, doctor, '2026-11-06')
    expect(grant?.scope).toBe('OWN')
    expect(grant?.permissions.has('encounter:write')).toBe(true)
    expect(grant?.permissions.has('audit_log:read')).toBe(true)
    expect(
      accessGrant({ ...membership, userId: desk.id }, desk, '2026-11-06')?.permissions.has('encounter:write'),
    ).toBe(false)
  })

  it('gives nothing for another user, a deactivated membership or after the deactivation date', () => {
    expect(accessGrant(membership, desk, '2026-11-06')).toBeNull()
    expect(accessGrant({ ...membership, status: 'DEACTIVATED' }, doctor, '2026-11-06')).toBeNull()
    const leaving = { ...membership, deactivatedFrom: '2026-11-07' }
    expect(isMembershipActive(leaving, '2026-11-06')).toBe(true)
    expect(isMembershipActive(leaving, '2026-11-07')).toBe(false)
    expect(isMembershipActive({ ...membership, deactivatedFrom: '2026-10-01' }, '2026-11-06')).toBe(false)
    expect(isMembershipActive({ ...membership, joinedOn: '2026-11-07' }, '2026-11-06')).toBe(false)
    expect(isMembershipActive({ ...membership, joinedOn: '2026-11-06' }, '2026-11-06')).toBe(true)
  })

  it('carries the license for signature checks', () => {
    expect(accessGrant(membership, doctor, '2026-11-06')?.licenseType).toBe('KOREAN_MEDICINE_DOCTOR')
  })
})

describe('membershipViolations', () => {
  it('requires an employment type for doctor roles only', () => {
    expect(membershipViolations({ ...membership, employmentType: ' ' })).toEqual([
      { field: 'employmentType', code: 'REQUIRED' },
    ])
    expect(membershipViolations({ ...membership, role: 'FRONT_DESK', employmentType: null })).toEqual([])
    expect(membershipViolations(membership)).toEqual([])
  })
})
