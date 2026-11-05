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

const visit: Visit = {
  id: 'vis_01JBQ000000000000000000001' as Visit['id'],
  patientId: 'pat_01JBQ000000000000000000001' as Visit['patientId'],
  date: '2026-11-05',
  status: 'WAITING',
  statusChangedAt: '2026-11-05T00:00:00.000Z',
  hasClinicalData: false,
  version: 1,
}

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
        const missing = yield* repository.findById(visit.id)
        yield* repository.save(visit, { expectedVersion: null })
        const next = changed(visit, 'IN_TREATMENT')
        yield* repository.save(next, { expectedVersion: 1, events: [event(next.statusChangedAt)] })
        const pending = yield* (yield* Outbox).pending(10)
        return { missing, found: yield* repository.findById(visit.id), pending }
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
          found: yield* repository.findById(visit.id),
          pending: yield* (yield* Outbox).pending(10),
        }
      }),
    )
    expect(result.stale).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 1 })
    expect(result.duplicate).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 1 })
    expect(result.found).toEqual(Option.some(visit))
    expect(result.pending).toEqual([])
  })

  it('keeps the optional reason absent when it was never set', async () => {
    const found = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* VisitRepository
        yield* repository.save(visit, { expectedVersion: null })
        return yield* repository.findById(visit.id)
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
        return { exit, found: yield* repository.findById(visit.id) }
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
    expect(applied.map((row) => row.name)).toEqual(['visits_and_outbox'])
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
      expect((await names()).map((row) => row.name)).toEqual(['visits_and_outbox'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
