import { Effect, Exit, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../persistence.ts'
import { AccessLog } from '../../shared/audit/access-log.ts'
import { Outbox } from '../../shared/events/outbox.ts'
import { CurrentAccess } from '../identity/auth/access.ts'
import { TEST_TENANT, testMember } from '../identity/auth/testing.ts'
import { TestPatientCrypto } from './patient-crypto.ts'
import { PatientRepository } from './patient-repository.ts'
import { Patients } from './patients.ts'

const desk = testMember({ role: 'FRONT_DESK' })
const otherTenant = testMember({
  tenant: { ...TEST_TENANT, id: 'ten_01JBQ000000000000000000002' as typeof TEST_TENANT.id },
})

type Services = Patients | Outbox | AccessLog | PatientRepository | CurrentAccess

const run = <A, E>(program: Effect.Effect<A, E, Services>, store: 'memory' | 'sqlite' = 'memory') =>
  Effect.runPromise(
    program.pipe(
      Effect.provideService(CurrentAccess, desk.access),
      Effect.provide(
        Patients.layer.pipe(
          Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
          Layer.provideMerge(TestPatientCrypto),
        ),
      ),
    ),
  )

const as = (member: ReturnType<typeof testMember>) => Effect.provideService(CurrentAccess, member.access)

describe.each(['memory', 'sqlite'] as const)('Patients (%s)', (store) => {
  it('registers with a sealed RRN, derives birth date and sex, and emits patient.created', async () => {
    const result = await run(
      Effect.gen(function* () {
        const patients = yield* Patients
        const patient = yield* patients.register({ name: ' 홍길동 ', rrn: '900101-2234567' })
        const stored = yield* (yield* PatientRepository).findById(TEST_TENANT.id, patient.id)
        return { patient, stored, pending: yield* (yield* Outbox).pending(10) }
      }),
      store,
    )
    expect(result.patient).toMatchObject({
      name: '홍길동',
      chartNumber: '1',
      rrnMasked: '900101-2******',
      birthDate: '1990-01-01',
      sex: 'FEMALE',
      consents: [],
      version: 1,
    })
    expect(result.patient).not.toHaveProperty('rrnSealed')
    expect(result.patient).not.toHaveProperty('rrnIndex')
    expect(JSON.stringify(result.stored)).not.toContain('2234567')
    expect(result.pending.map((row) => [row.event.type, row.event.tenantId, row.event.actor, row.event.data])).toEqual([
      [
        'patient.created',
        TEST_TENANT.id,
        { kind: 'USER', id: desk.user.id },
        { patientId: result.patient.id, chartNumber: '1' },
      ],
    ])
  })

  it('reveals the RRN only after recording who read it and why', async () => {
    const result = await run(
      Effect.gen(function* () {
        const patients = yield* Patients
        const patient = yield* patients.register({ name: '홍길동', rrn: '9001011234567' })
        const revealed = yield* patients.revealRrn(patient.id, '보험 자격 조회')
        const hidden = yield* Effect.flip(patients.revealRrn(patient.id, '다른 병원').pipe(as(otherTenant)))
        return { revealed, hidden, log: yield* (yield* AccessLog).list(TEST_TENANT.id), patient }
      }),
      store,
    )
    expect(result.revealed).toEqual({ rrn: '900101-1234567' })
    expect(result.hidden).toMatchObject({ code: 'PATIENT_NOT_FOUND' })
    expect(result.log).toEqual([
      {
        time: expect.any(String),
        tenantId: TEST_TENANT.id,
        userId: desk.user.id,
        action: 'READ_RRN',
        resource: 'patient',
        resourceId: result.patient.id,
        reason: '보험 자격 조회',
      },
    ])
  })

  it('updates only what changed and names the fields in patient.updated', async () => {
    const result = await run(
      Effect.gen(function* () {
        const patients = yield* Patients
        const patient = yield* patients.register({ name: '홍길동', rrn: '9001011234567', notes: '메모' })
        const same = yield* patients.update(patient.id, { name: '홍길동' })
        const changed = yield* patients.update(
          patient.id,
          { rrn: '9101011234567', birthDate: '1991-01-01', notes: null },
          { expectedVersion: 1 },
        )
        const stale = yield* Effect.flip(patients.update(patient.id, { name: '김' }, { expectedVersion: 1 }))
        const mismatch = yield* Effect.flip(patients.update(patient.id, { sex: 'FEMALE' }))
        const pending = yield* (yield* Outbox).pending(10)
        return { same, changed, stale, mismatch, events: pending.map((row) => row.event.data) }
      }),
      store,
    )
    expect(result.same.version).toBe(1)
    expect(result.changed).toMatchObject({ version: 2, rrnMasked: '910101-1******', notes: null })
    expect(result.stale).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 2 })
    expect(result.mismatch).toMatchObject({ violations: [{ field: 'sex', code: 'RRN_MISMATCH' }] })
    expect(result.events.at(-1)).toEqual({
      patientId: result.changed.id,
      fields: ['rrn', 'birthDate', 'notes'],
    })
  })

  it('refuses inconsistent registrations with every violation at once', async () => {
    const error = await run(
      Effect.flip(
        Effect.gen(function* () {
          return yield* (yield* Patients).register({
            name: '홍길동',
            rrn: '9001011234567',
            birthDate: '1990-02-30',
            sex: 'FEMALE',
            contacts: [
              { kind: 'MOBILE', number: '010-1111-2222', isPrimary: true },
              { kind: 'HOME', number: '02-111-2222', isPrimary: true },
            ],
          })
        }),
      ),
      store,
    )
    expect(error).toMatchObject({
      violations: [
        { field: 'contacts', code: 'MULTIPLE_PRIMARY' },
        { field: 'birthDate', code: 'INVALID_VALUE' },
        { field: 'sex', code: 'RRN_MISMATCH' },
      ],
    })
  })

  it('keeps consent history, shows the latest per purpose, and respects an 080 opt-out', async () => {
    const result = await run(
      Effect.gen(function* () {
        const patients = yield* Patients
        const repository = yield* PatientRepository
        const patient = yield* patients.register({ name: '홍길동' })
        // 080 거부와 태블릿 동의는 연동·기기 입구가 저장소에 직접 씁니다
        const fromPatient = (status: 'WITHDRAWN' | 'GRANTED', source: 'PATIENT_080' | 'TABLET') =>
          repository.appendConsent(
            TEST_TENANT.id,
            {
              patientId: patient.id,
              purpose: 'MARKETING_SMS',
              status,
              source,
              decidedAt: '2026-11-06T01:00:00.000Z',
              decidedBy: null,
              evidenceDocumentId: null,
            },
            [],
          )
        const grant = (purpose: string) => patients.recordConsent(patient.id, { purpose, status: 'GRANTED' })
        yield* grant('MARKETING_SMS')
        yield* grant('INFO_MESSAGE')
        yield* fromPatient('WITHDRAWN', 'PATIENT_080')
        const locked = yield* Effect.flip(grant('MARKETING_SMS'))
        // 다른 상태를 끼워 넣어도 잠금은 풀리지 않습니다
        yield* patients.recordConsent(patient.id, { purpose: 'MARKETING_SMS', status: 'UNDECIDED' })
        const stillLocked = yield* Effect.flip(grant('MARKETING_SMS'))
        const current = (yield* patients.get(patient.id)).consents
        yield* fromPatient('GRANTED', 'TABLET')
        yield* patients.recordConsent(patient.id, { purpose: 'MARKETING_SMS', status: 'WITHDRAWN' })
        yield* grant('MARKETING_SMS')
        return {
          locked,
          stillLocked,
          current,
          history: yield* patients.consentHistory(patient.id),
          events: (yield* (yield* Outbox).pending(20)).filter((row) => row.event.type === 'consent.changed'),
        }
      }),
      store,
    )
    expect(result.locked).toMatchObject({ code: 'CONSENT_LOCKED_BY_PATIENT', purpose: 'MARKETING_SMS' })
    expect(result.stillLocked).toMatchObject({ code: 'CONSENT_LOCKED_BY_PATIENT' })
    expect(result.current.map((each) => [each.purpose, each.status, each.source])).toEqual([
      ['INFO_MESSAGE', 'GRANTED', 'DESK'],
      ['MARKETING_SMS', 'UNDECIDED', 'DESK'],
    ])
    expect(result.history.map((each) => [each.purpose === 'MARKETING_SMS', each.status, each.source])).toEqual([
      [true, 'GRANTED', 'DESK'],
      [false, 'GRANTED', 'DESK'],
      [true, 'WITHDRAWN', 'PATIENT_080'],
      [true, 'UNDECIDED', 'DESK'],
      [true, 'GRANTED', 'TABLET'],
      [true, 'WITHDRAWN', 'DESK'],
      [true, 'GRANTED', 'DESK'],
    ])
    expect(result.events.map((row) => row.event.data['status'])).toEqual([
      'GRANTED',
      'GRANTED',
      'UNDECIDED',
      'WITHDRAWN',
      'GRANTED',
    ])
    expect(result.events[0]?.event.actor).toEqual({ kind: 'USER', id: desk.user.id })
  })

  it('returns no RRN when the access log cannot be written', async () => {
    const failingLog = Layer.succeed(AccessLog, {
      record: () => Effect.die(new Error('log down')),
      list: () => Effect.succeed([]),
    })
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const patients = yield* Patients
        const patient = yield* patients.register({ name: '홍길동', rrn: '9001011234567' })
        return yield* patients.revealRrn(patient.id, '보험 조회')
      }).pipe(
        Effect.provideService(CurrentAccess, desk.access),
        Effect.provide(
          Patients.layer.pipe(
            Layer.provide(failingLog),
            Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
            Layer.provideMerge(TestPatientCrypto),
          ),
        ),
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(JSON.stringify(exit)).not.toContain('1234567')
  })

  it('finds chart numbers with hyphens and folds non-ASCII case the same in both stores', async () => {
    const found = await run(
      Effect.gen(function* () {
        const patients = yield* Patients
        yield* patients.register({ name: 'Émile', chartNumber: '2024-001' })
        const names = (q: string) =>
          patients.search({ q, limit: 10 }).pipe(Effect.map((page) => page.items.map((each) => each.name)))
        return [yield* names('2024-0'), yield* names('émi'), yield* names('ÉMI')]
      }),
      store,
    )
    expect(found).toEqual([['Émile'], ['Émile'], ['Émile']])
  })

  it('pages search results with an opaque cursor and rejects a broken one', async () => {
    const result = await run(
      Effect.gen(function* () {
        const patients = yield* Patients
        for (const name of ['가', '나', '다']) yield* patients.register({ name })
        const first = yield* patients.search({ limit: 2 })
        const second = yield* patients.search({ limit: 2, cursor: first.nextCursor! })
        const broken = yield* Effect.flip(patients.search({ limit: 2, cursor: 'not-a-cursor' }))
        return { first, second, broken }
      }),
      store,
    )
    expect(result.first.items.map((each) => each.name)).toEqual(['가', '나'])
    expect(result.second).toMatchObject({ items: [{ name: '다' }], nextCursor: null })
    expect(result.broken).toMatchObject({ violations: [{ field: 'cursor', code: 'INVALID_VALUE' }] })
  })
})
