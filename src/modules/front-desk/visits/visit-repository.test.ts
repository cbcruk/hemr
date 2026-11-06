import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Exit, Layer, Option } from 'effect'
import { SqlClient } from 'effect/sql'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Visit } from './visit.ts'
import { VisitRepository } from './visit-repository.ts'
import { testVisit } from './testing.ts'

const TENANT = 'ten_01JBQ000000000000000000001' as Visit['tenantId']
const OTHER_TENANT = 'ten_01JBQ000000000000000000002' as Visit['tenantId']

const visit = testVisit({ tenantId: TENANT, date: '2026-11-05' })

const changed = (from: Visit, to: Visit['status']): Visit => ({
  ...from,
  status: to,
  statusReason: '사유',
  version: from.version + 1,
})
const event = (time: string) => domainEvent('visit.status_changed', visit.id, time, { visitId: visit.id })

type Persistence = Layer.Layer<VisitRepository | Outbox, unknown>

const run = <A, E>(layer: Persistence, program: Effect.Effect<A, E, VisitRepository | Outbox>) =>
  Effect.runPromise(program.pipe(Effect.provide(layer)))

/** 메모리와 SQLite 구현이 같은 계약을 지키는지 봅니다. */
describe.each([
  ['memory', () => PersistenceMemory()],
  ['sqlite', () => PersistenceSqlite(':memory:')],
] as const)('VisitRepository (%s)', (_, layer) => {
  it('inserts, finds and updates with the expected version', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* VisitRepository
        const missing = yield* repository.findById(TENANT, visit.id)
        yield* repository.save(visit, { expectedVersion: null })
        const next = changed(visit, 'IN_TREATMENT')
        yield* repository.save(next, { expectedVersion: 1, events: [event(next.statusChangedAt)] })
        const pending = yield* (yield* Outbox).pending(10)
        return { missing, found: yield* repository.findById(TENANT, visit.id), pending }
      }),
    )
    expect(Option.isNone(result.missing)).toBe(true)
    expect(result.found).toEqual(Option.some(changed(visit, 'IN_TREATMENT')))
    expect(result.pending.map((row) => [row.event.seq, row.event.type, row.attempts])).toEqual([
      [1, 'visit.status_changed', 0],
    ])
  })

  it('rejects a stale version or a duplicate insert without writing anything', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* VisitRepository
        yield* repository.save(visit, { expectedVersion: null })
        const stale = yield* Effect.flip(
          repository.save(changed(visit, 'CANCELED'), { expectedVersion: 7, events: [event(visit.statusChangedAt)] }),
        )
        const duplicate = yield* Effect.flip(repository.save(visit, { expectedVersion: null }))
        return {
          stale,
          duplicate,
          found: yield* repository.findById(TENANT, visit.id),
          pending: yield* (yield* Outbox).pending(10),
        }
      }),
    )
    expect(result.stale).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 1 })
    expect(result.duplicate).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 1 })
    expect(result.found).toEqual(Option.some(visit))
    expect(result.pending).toEqual([])
  })

  it('hides and protects a visit of another tenant', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* VisitRepository
        yield* repository.save(visit, { expectedVersion: null })
        const intruder = { ...changed(visit, 'CANCELED'), tenantId: OTHER_TENANT }
        return {
          found: yield* repository.findById(OTHER_TENANT, visit.id),
          update: yield* Effect.flip(
            repository.save(intruder, { expectedVersion: 1, events: [event(visit.statusChangedAt)] }),
          ),
          insert: yield* Effect.flip(repository.save({ ...visit, tenantId: OTHER_TENANT }, { expectedVersion: null })),
          own: yield* repository.findById(TENANT, visit.id),
          pending: yield* (yield* Outbox).pending(10),
        }
      }),
    )
    expect(Option.isNone(result.found)).toBe(true)
    // 다른 병원 내원의 버전(1)이 드러나지 않게 없는 내원처럼 0으로 답합니다
    expect(result.update).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 0 })
    expect(result.insert).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 0 })
    expect(result.own).toEqual(Option.some(visit))
    expect(result.pending).toEqual([])
  })

  it('lists a day of one tenant in check-in order and filters by status', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* VisitRepository
        const at = (n: number, overrides: Partial<Visit>) =>
          testVisit({
            id: `vis_01JBQ00000000000000000000${n}` as Visit['id'],
            tenantId: TENANT,
            date: '2026-11-05',
            checkedInAt: `2026-11-05T0${n}:00:00.000Z`,
            ...overrides,
          })
        for (const each of [
          at(3, {}),
          at(1, { status: 'IN_TREATMENT' }),
          at(2, {}),
          at(4, { date: '2026-11-04' }),
          at(5, { tenantId: OTHER_TENANT }),
        ]) {
          yield* repository.save(each, { expectedVersion: null })
        }
        const ids = (visits: ReadonlyArray<Visit>) => visits.map((each) => each.id.slice(-1))
        return {
          day: ids(yield* repository.list(TENANT, { date: '2026-11-05' })),
          waiting: ids(yield* repository.list(TENANT, { date: '2026-11-05', status: 'WAITING' })),
          stored: (yield* repository.list(TENANT, { date: '2026-11-04' }))[0],
        }
      }),
    )
    expect(result.day).toEqual(['1', '2', '3'])
    expect(result.waiting).toEqual(['2', '3'])
    expect(result.stored?.eligibility).toEqual(visit.eligibility)
    expect(result.stored?.benefitFlags).toEqual(visit.benefitFlags)
  })

  it('reports the first visit and the last identity check, skipping canceled visits and other patients', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* VisitRepository
        const verified = (identityVerified: boolean) => ({ ...visit.eligibility, identityVerified })
        const seed = [
          testVisit({
            id: 'vis_01JBQ000000000000000000001' as Visit['id'],
            tenantId: TENANT,
            date: '2026-01-10',
            status: 'CANCELED',
            eligibility: verified(true),
          }),
          testVisit({
            id: 'vis_01JBQ000000000000000000002' as Visit['id'],
            tenantId: TENANT,
            date: '2026-03-01',
            status: 'COMPLETED',
            eligibility: verified(true),
          }),
          testVisit({
            id: 'vis_01JBQ000000000000000000003' as Visit['id'],
            tenantId: TENANT,
            date: '2026-05-01',
            status: 'COMPLETED',
            eligibility: verified(false),
          }),
          testVisit({
            id: 'vis_01JBQ000000000000000000004' as Visit['id'],
            tenantId: TENANT,
            date: '2026-06-01',
            status: 'CANCELED',
            eligibility: verified(true),
          }),
          testVisit({
            id: 'vis_01JBQ000000000000000000005' as Visit['id'],
            tenantId: TENANT,
            patientId: 'pat_01JBQ000000000000000000009' as Visit['patientId'],
            date: '2025-01-01',
            eligibility: verified(true),
          }),
          testVisit({
            id: 'vis_01JBQ000000000000000000006' as Visit['id'],
            tenantId: OTHER_TENANT,
            date: '2025-01-01',
            eligibility: verified(true),
          }),
        ]
        for (const each of seed) yield* repository.save(each, { expectedVersion: null })
        return {
          patient: yield* repository.historyOf(TENANT, visit.patientId),
          unknown: yield* repository.historyOf(TENANT, 'pat_01JBQ000000000000000000008' as Visit['patientId']),
        }
      }),
    )
    expect(result.patient).toEqual({ firstVisitDate: '2026-03-01', lastIdentityVerifiedOn: '2026-03-01' })
    expect(result.unknown).toEqual({ firstVisitDate: null, lastIdentityVerifiedOn: null })
  })

  it('keeps the optional reason absent when it was never set', async () => {
    const found = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* VisitRepository
        yield* repository.save(visit, { expectedVersion: null })
        return yield* repository.findById(TENANT, visit.id)
      }),
    )
    expect(Option.getOrThrow(found)).not.toHaveProperty('statusReason')
  })
})

describe('VisitRepository (sqlite) transaction', () => {
  it('rolls back the visit when the outbox write fails', async () => {
    const duplicateEvent = event('2026-11-05T00:00:01.000Z')
    const result = await run(
      PersistenceSqlite(':memory:'),
      Effect.gen(function* () {
        const repository = yield* VisitRepository
        yield* repository.save(visit, { expectedVersion: null, events: [duplicateEvent] })
        // 같은 이벤트 ID를 다시 쓰면 outbox 유니크 제약에 걸립니다
        const exit = yield* Effect.exit(
          repository.save(changed(visit, 'IN_TREATMENT'), { expectedVersion: 1, events: [duplicateEvent] }),
        )
        return { exit, found: yield* repository.findById(TENANT, visit.id) }
      }),
    )
    expect(Exit.isFailure(result.exit)).toBe(true)
    expect(result.found).toEqual(Option.some(visit))
  })

  it('records applied migrations', async () => {
    const applied = await Effect.runPromise(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        return yield* sql<{ name: string }>`SELECT name FROM effect_sql_migrations`
      }).pipe(Effect.provide(PersistenceSqlite(':memory:'))),
    )
    expect(applied.map((row) => row.name)).toEqual([
      'visits_and_outbox',
      'identity',
      'auth',
      'visit_tenant',
      'patients',
      'visit_check_in',
    ])
  })

  it('applies migrations once across restarts of the same file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hemr-'))
    const names = () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          return yield* sql<{ name: string }>`SELECT name FROM effect_sql_migrations`
        }).pipe(Effect.provide(PersistenceSqlite(join(dir, 'hemr.sqlite')))),
      )
    try {
      await names()
      expect((await names()).map((row) => row.name)).toEqual([
        'visits_and_outbox',
        'identity',
        'auth',
        'visit_tenant',
        'patients',
        'visit_check_in',
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
