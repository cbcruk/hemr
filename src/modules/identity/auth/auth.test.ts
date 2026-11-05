import { Clock, Effect, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import type { Membership, Tenant, User } from '../identity.ts'
import { IdentityRepository } from '../identity-repository.ts'
import { Auth } from './auth.ts'
import { TestAuthConfig } from './auth-config.ts'
import { AuthRepository } from './auth-repository.ts'
import { hashPassword } from './password.ts'
import { SecurityLog } from './security-log.ts'

const T0 = Date.parse('2026-11-06T01:00:00.000Z')
const SECOND = 1000

const tenantA: Tenant = {
  id: 'ten_01JBQ00000000000000000000A' as Tenant['id'],
  name: 'A한의원',
  hiraInstitutionCode: null,
  timezone: 'Asia/Seoul',
  products: ['EMR', 'CRM'],
  features: ['telemedicine'],
}
const tenantB: Tenant = { ...tenantA, id: 'ten_01JBQ00000000000000000000B' as Tenant['id'], name: 'B한의원' }
const doctor: User = {
  id: 'usr_01JBQ0000000000000000000DR' as User['id'],
  loginId: 'doctor',
  name: '김원장',
  phone: null,
  licenseNumber: '12345',
  licenseType: 'KOREAN_MEDICINE_DOCTOR',
}
const desk: User = { ...doctor, id: 'usr_01JBQ0000000000000000000DK' as User['id'], loginId: 'desk', licenseType: null }
const member = (user: User, tenant: Tenant, role: Membership['role']): Membership => ({
  tenantId: tenant.id,
  userId: user.id,
  role,
  employmentType: '상근',
  joinedOn: '2026-01-01',
  status: 'ACTIVE',
  deactivatedFrom: null,
  scope: 'ALL',
  grants: [],
})

/** 시험 중에 시각을 옮길 수 있는 시계입니다. */
function testClock() {
  let now = T0
  const clock: Clock.Clock = {
    currentTimeMillisUnsafe: () => now,
    currentTimeMillis: Effect.sync(() => now),
    currentTimeNanosUnsafe: () => BigInt(now) * 1_000_000n,
    currentTimeNanos: Effect.sync(() => BigInt(now) * 1_000_000n),
    monotonicTimeNanosUnsafe: () => BigInt(now) * 1_000_000n,
    monotonicTimeNanos: Effect.sync(() => BigInt(now) * 1_000_000n),
    sleep: () => Effect.void,
  }
  return { clock, advance: (millis: number) => Effect.sync(() => void (now += millis)) }
}

const seed = Effect.gen(function* () {
  const identity = yield* IdentityRepository
  const store = yield* AuthRepository
  yield* identity.saveTenant(tenantA)
  yield* identity.saveTenant(tenantB)
  for (const user of [doctor, desk]) {
    yield* identity.saveUser(user).pipe(Effect.orDie)
    yield* store.savePassword(user.id, yield* hashPassword(`${user.loginId}-password`))
  }
  yield* identity.saveMembership(member(doctor, tenantA, 'OWNER_DOCTOR'))
  yield* identity.saveMembership(member(doctor, tenantB, 'ASSOCIATE_DOCTOR'))
  yield* identity.saveMembership(member(desk, tenantA, 'FRONT_DESK'))
})

describe.each([
  ['memory', () => PersistenceMemory()],
  ['sqlite', () => PersistenceSqlite(':memory:')],
] as const)('Auth (%s)', (_, persistence) => {
  const run = <A, E>(
    program: (
      clock: ReturnType<typeof testClock>,
    ) => Effect.Effect<A, E, Auth | SecurityLog | AuthRepository | IdentityRepository>,
  ) => {
    const clock = testClock()
    const layer = Auth.layer.pipe(Layer.provideMerge(Layer.merge(persistence(), TestAuthConfig)))
    return Effect.runPromise(
      Effect.gen(function* () {
        yield* seed
        return yield* program(clock)
      }).pipe(Effect.provide(layer), Effect.provideService(Clock.Clock, clock.clock)),
    )
  }
  const login = (loginId: string, password = `${loginId}-password`) =>
    Effect.flatMap(Auth, (auth) => auth.login({ loginId, password }))

  it('logs in, picks the only tenant and records the success', async () => {
    const result = await run(() =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const session = yield* login(' DESK ', 'desk-password')
        return {
          session,
          me: yield* auth.me(yield* auth.authenticate(session.accessToken)),
          log: yield* (yield* SecurityLog).list,
        }
      }),
    )
    expect(result.session).toMatchObject({
      expiresIn: 600,
      tenantId: tenantA.id,
      user: { id: desk.id, loginId: 'desk', name: '김원장', licenseType: null },
      memberships: [{ tenantId: tenantA.id, tenantName: 'A한의원', role: 'FRONT_DESK' }],
    })
    expect(result.me).toMatchObject({
      tenant: { id: tenantA.id, name: 'A한의원', products: ['EMR', 'CRM'], features: ['telemedicine'] },
      role: 'FRONT_DESK',
      scope: 'ALL',
    })
    expect(result.me.permissions).toContain('receipt:create')
    expect(result.me.permissions).not.toContain('report:read')
    expect(result.me.permissions).toEqual([...result.me.permissions].sort())
    expect(result.log).toEqual([
      expect.objectContaining({ type: 'LOGIN_SUCCEEDED', loginId: 'desk', userId: desk.id, tenantId: tenantA.id }),
    ])
  })

  it('asks a user with several tenants to choose one, and switches only to an active membership', async () => {
    const result = await run(() =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const session = yield* login('doctor')
        const current = yield* auth.authenticate(session.accessToken)
        const before = yield* auth.me(current)
        const switched = yield* auth.switchTenant(current, tenantB.id)
        const after = yield* auth.me(yield* auth.authenticate(switched.accessToken))
        const denied = yield* Effect.flip(auth.switchTenant(current, 'ten_01JBQ00000000000000000000C' as Tenant['id']))
        const refreshed = yield* auth.refresh({ refreshToken: session.refreshToken })
        const resumed = yield* auth.authenticate(refreshed.accessToken)
        return { session, before, after, denied, resumed }
      }),
    )
    expect(result.session.tenantId).toBeNull()
    expect(result.session.memberships.map((each) => each.tenantId)).toEqual([tenantA.id, tenantB.id])
    expect(result.before).toMatchObject({ tenant: null, role: null, scope: null, permissions: [] })
    expect(result.after).toMatchObject({ tenant: { id: tenantB.id }, role: 'ASSOCIATE_DOCTOR' })
    expect(result.after.permissions).toContain('encounter:write')
    expect(result.denied._tag).toBe('TenantAccessDenied')
    // 전환한 병원은 세션에 남아 refresh 뒤에도 이어집니다
    expect(result.resumed.tenantId).toBe(tenantB.id)
  })

  it('gives the same error for an unknown login id and a wrong password', async () => {
    const result = await run(() =>
      Effect.gen(function* () {
        const unknown = yield* Effect.flip(login('nobody', 'whatever'))
        const wrong = yield* Effect.flip(login('desk', 'wrong'))
        return { unknown, wrong, log: yield* (yield* SecurityLog).list }
      }),
    )
    expect(result.unknown._tag).toBe('InvalidCredentials')
    expect(result.wrong._tag).toBe('InvalidCredentials')
    expect(result.log.map((each) => [each.type, each.loginId, each.detail])).toEqual([
      ['LOGIN_FAILED', 'nobody', 'UNKNOWN_LOGIN_ID'],
      ['LOGIN_FAILED', 'desk', 'PASSWORD_MISMATCH'],
    ])
  })

  it('locks the account on the fifth failure in a row, even for the right password afterwards', async () => {
    const result = await run(() =>
      Effect.gen(function* () {
        const errors = []
        for (let i = 0; i < 5; i++) errors.push((yield* Effect.flip(login('desk', 'wrong')))._tag)
        const afterLock = yield* Effect.flip(login('desk'))
        const log = yield* (yield* SecurityLog).list
        return { errors, afterLock, log }
      }),
    )
    expect(result.errors).toEqual([...Array(4).fill('InvalidCredentials'), 'AccountLocked'])
    expect(result.afterLock._tag).toBe('AccountLocked')
    expect(result.log.filter((each) => each.type === 'ACCOUNT_LOCKED')).toHaveLength(1)
    expect(result.log.at(-1)).toMatchObject({ type: 'LOGIN_FAILED', detail: 'LOCKED' })
  })

  it('resets the failure count after a successful login', async () => {
    const credential = await run(() =>
      Effect.gen(function* () {
        for (let i = 0; i < 4; i++) yield* Effect.flip(login('desk', 'wrong'))
        yield* login('desk')
        for (let i = 0; i < 4; i++) yield* Effect.flip(login('desk', 'wrong'))
        return yield* (yield* AuthRepository).findCredential(desk.id)
      }),
    )
    expect(Option.getOrThrow(credential)).toMatchObject({ failedAttempts: 4, lockedAt: null })
  })

  it('rotates the refresh token and revokes the session when an old one comes back', async () => {
    const result = await run(({ advance }) =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const session = yield* login('desk')
        const first = yield* auth.refresh({ refreshToken: session.refreshToken })
        const second = yield* auth.refresh({ refreshToken: first.refreshToken ?? undefined })
        yield* advance(11 * SECOND)
        const replay = yield* Effect.flip(auth.refresh({ refreshToken: session.refreshToken }))
        const latest = yield* Effect.flip(auth.refresh({ refreshToken: second.refreshToken ?? undefined }))
        const access = yield* Effect.flip(auth.authenticate(second.accessToken))
        return { session, first, second, replay, latest, access, log: yield* (yield* SecurityLog).list }
      }),
    )
    expect(result.first.refreshToken).not.toBe(result.session.refreshToken)
    expect(result.second.refreshToken).not.toBe(result.first.refreshToken)
    expect(result.replay._tag).toBe('Unauthenticated')
    // 재사용을 감지하면 최신 토큰과 access token도 그 세션째 쓸 수 없습니다
    expect(result.latest._tag).toBe('Unauthenticated')
    expect(result.access._tag).toBe('Unauthenticated')
    expect(result.log.at(-1)).toMatchObject({ type: 'REFRESH_TOKEN_REUSED', userId: desk.id })
  })

  it('treats a replay within the grace period as a concurrent refresh from another tab', async () => {
    const result = await run(({ advance }) =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const session = yield* login('desk')
        const first = yield* auth.refresh({ refreshToken: session.refreshToken })
        yield* advance(5 * SECOND)
        const concurrent = yield* auth.refresh({ refreshToken: session.refreshToken })
        const next = yield* auth.refresh({ refreshToken: first.refreshToken ?? undefined })
        return { concurrent, next, current: yield* auth.authenticate(concurrent.accessToken) }
      }),
    )
    expect(result.concurrent.refreshToken).toBeNull()
    expect(result.next.refreshToken).not.toBeNull()
    expect(result.current.userId).toBe(desk.id)
  })

  it('expires access and refresh tokens', async () => {
    const result = await run(({ advance }) =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const session = yield* login('desk')
        yield* advance(600 * SECOND)
        const access = yield* Effect.flip(auth.authenticate(session.accessToken))
        yield* advance(12 * 3600 * SECOND)
        const refresh = yield* Effect.flip(auth.refresh({ refreshToken: session.refreshToken }))
        const missing = yield* Effect.flip(auth.refresh({ refreshToken: undefined }))
        const unknown = yield* Effect.flip(auth.refresh({ refreshToken: 'not-a-token' }))
        return [access, refresh, missing, unknown].map((each) => each._tag)
      }),
    )
    expect(result).toEqual(Array(4).fill('Unauthenticated'))
  })

  it('logs out by revoking the session', async () => {
    const result = await run(() =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const session = yield* login('desk')
        yield* auth.logout({ refreshToken: session.refreshToken, accessToken: undefined })
        yield* auth.logout({ refreshToken: session.refreshToken, accessToken: undefined })
        yield* auth.logout({ refreshToken: undefined, accessToken: undefined })
        return {
          access: yield* Effect.flip(auth.authenticate(session.accessToken)),
          refresh: yield* Effect.flip(auth.refresh({ refreshToken: session.refreshToken })),
          log: (yield* (yield* SecurityLog).list).map((each) => each.type),
        }
      }),
    )
    expect(result.access._tag).toBe('Unauthenticated')
    expect(result.refresh._tag).toBe('Unauthenticated')
    expect(result.log).toEqual(['LOGIN_SUCCEEDED', 'LOGGED_OUT'])
  })

  it('drops permissions as soon as the membership is deactivated', async () => {
    const me = await run(() =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const session = yield* login('desk')
        yield* (yield* IdentityRepository).saveMembership({
          ...member(desk, tenantA, 'FRONT_DESK'),
          status: 'DEACTIVATED',
        })
        return yield* auth.me(yield* auth.authenticate(session.accessToken))
      }),
    )
    expect(me).toMatchObject({ tenant: null, memberships: [], permissions: [] })
  })

  it('never leaves a live session on an account locked by parallel guesses', async () => {
    const result = await run(() =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const attempts = [...Array(20).fill('wrong'), 'desk-password'].map((password) =>
          Effect.result(login('desk', password)),
        )
        const results = yield* Effect.all(attempts, { concurrency: 'unbounded' })
        const success = results.at(-1)!
        const live =
          success._tag === 'Success' ? yield* Effect.exit(auth.authenticate(success.success.accessToken)) : undefined
        return { live, credential: yield* (yield* AuthRepository).findCredential(desk.id) }
      }),
    )
    expect(Option.getOrThrow(result.credential).lockedAt).not.toBeNull()
    // 맞는 비밀번호가 먼저 끝났더라도, 그 뒤 잠금이 세션을 폐기합니다
    expect(result.live === undefined || result.live._tag === 'Failure').toBe(true)
  })

  it('revokes existing sessions when the account gets locked', async () => {
    const access = await run(() =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const session = yield* login('desk')
        for (let i = 0; i < 5; i++) yield* Effect.flip(login('desk', 'wrong'))
        return {
          access: yield* Effect.flip(auth.authenticate(session.accessToken)),
          refresh: yield* Effect.flip(auth.refresh({ refreshToken: session.refreshToken })),
        }
      }),
    )
    expect([access.access._tag, access.refresh._tag]).toEqual(['Unauthenticated', 'Unauthenticated'])
  })

  it('rotates a token only once under concurrent refreshes', async () => {
    const results = await run(() =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const session = yield* login('desk')
        return yield* Effect.all(
          Array.from({ length: 5 }, () => auth.refresh({ refreshToken: session.refreshToken })),
          { concurrency: 'unbounded' },
        )
      }),
    )
    expect(results.filter((each) => each.refreshToken !== null)).toHaveLength(1)
  })

  it('keeps the tenant a tab asked for when another tab switched', async () => {
    const result = await run(() =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const session = yield* login('doctor')
        const current = yield* auth.authenticate(session.accessToken)
        const tabA = yield* auth.authenticate((yield* auth.switchTenant(current, tenantA.id)).accessToken)
        yield* auth.switchTenant(current, tenantB.id)
        const refreshedA = yield* auth.refresh({ refreshToken: session.refreshToken, tenantId: tabA.tenantId! })
        const elsewhere = yield* auth.refresh({
          refreshToken: refreshedA.refreshToken!,
          tenantId: 'ten_01JBQ00000000000000000000C' as Tenant['id'],
        })
        const log = yield* (yield* SecurityLog).list
        return { refreshedA, elsewhere, switched: log.filter((each) => each.type === 'TENANT_SWITCHED') }
      }),
    )
    expect(result.refreshedA.tenantId).toBe(tenantA.id)
    expect(result.elsewhere.tenantId).toBeNull()
    expect(result.switched.map((each) => each.tenantId)).toEqual([tenantA.id, tenantB.id])
  })

  it('logs out with the access token when the cookie is missing', async () => {
    const access = await run(() =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const session = yield* login('desk')
        yield* auth.logout({ refreshToken: undefined, accessToken: session.accessToken })
        return yield* Effect.flip(auth.authenticate(session.accessToken))
      }),
    )
    expect(access._tag).toBe('Unauthenticated')
  })

  it('handles a user without a password or without memberships', async () => {
    const result = await run(() =>
      Effect.gen(function* () {
        const identity = yield* IdentityRepository
        const loner: User = { ...desk, id: 'usr_01JBQ0000000000000000000LN' as User['id'], loginId: 'loner' }
        const nopass: User = { ...desk, id: 'usr_01JBQ0000000000000000000NP' as User['id'], loginId: 'nopass' }
        yield* identity.saveUser(loner).pipe(Effect.orDie)
        yield* identity.saveUser(nopass).pipe(Effect.orDie)
        yield* (yield* AuthRepository).savePassword(loner.id, yield* hashPassword('loner-password'))
        const noPassword = yield* Effect.flip(login('nopass', 'anything'))
        const alone = yield* login('loner')
        const log = yield* (yield* SecurityLog).list
        return { noPassword, alone, detail: log[0]?.detail }
      }),
    )
    expect(result.noPassword._tag).toBe('InvalidCredentials')
    expect(result.detail).toBe('NO_PASSWORD')
    expect(result.alone).toMatchObject({ tenantId: null, memberships: [] })
  })
})
