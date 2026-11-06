import { Effect, Exit, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import { TEST_TENANT } from '../../identity/auth/testing.ts'
import type { Procedure } from './procedure.ts'
import { ProcedureRepository } from './procedure-repository.ts'

const OTHER_TENANT = 'ten_01JBQ000000000000000000002' as Procedure['tenantId']
const VISIT_1 = 'vis_01JBQ000000000000000000001' as Procedure['visitId']
const VISIT_2 = 'vis_01JBQ000000000000000000002' as Procedure['visitId']

const procedure = (n: number, overrides: Partial<Procedure> = {}): Procedure => ({
  id: `prc_01JBQ00000000000000000000${n}` as Procedure['id'],
  tenantId: TEST_TENANT.id,
  visitId: VISIT_1,
  patientId: 'pat_01JBQ000000000000000000001' as Procedure['patientId'],
  name: `시술 ${n}`,
  sourcePrescriptionLineId: null,
  order: n,
  assignee: 'STAFF',
  durationSeconds: 600,
  status: 'PENDING',
  startedAt: null,
  timerEndsAt: null,
  completedAt: null,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
  version: 1,
  ...overrides,
})

/** `start`부터 `seconds`초 동안 진행 중인 시술입니다. */
const running = (n: number, start: string, seconds: number, overrides: Partial<Procedure> = {}) =>
  procedure(n, {
    status: 'RUNNING',
    durationSeconds: seconds,
    startedAt: start,
    timerEndsAt: new Date(Date.parse(start) + seconds * 1000).toISOString(),
    ...overrides,
  })

const event = (subject: Procedure) =>
  domainEvent(
    'procedure.updated',
    subject.id,
    subject.updatedAt,
    { procedureId: subject.id },
    { tenantId: subject.tenantId, actor: { kind: 'SYSTEM', id: 'test' } },
  )

const run = <A, E>(
  layer: Layer.Layer<ProcedureRepository | Outbox, unknown>,
  program: Effect.Effect<A, E, ProcedureRepository | Outbox>,
) => Effect.runPromise(program.pipe(Effect.provide(layer)))

const insert = (...procedures: Procedure[]) =>
  Effect.gen(function* () {
    yield* (yield* ProcedureRepository).saveAll(procedures.map((each) => ({ procedure: each, expectedVersion: null })))
  })

/** 메모리와 SQLite 구현이 같은 계약을 지키는지 봅니다. */
describe.each([
  ['memory', () => PersistenceMemory()],
  ['sqlite', () => PersistenceSqlite(':memory:')],
] as const)('ProcedureRepository (%s)', (_, layer) => {
  it('inserts, updates with the expected version and writes the events with them', async () => {
    const first = procedure(1)
    const next = running(1, '2026-11-06T01:00:00.000Z', 600, { updatedAt: '2026-11-06T01:00:00.000Z', version: 2 })
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* ProcedureRepository
        yield* repository.saveAll([{ procedure: first, expectedVersion: null }], [event(first)])
        yield* repository.saveAll([{ procedure: next, expectedVersion: 1 }], [event(next)])
        return {
          found: yield* repository.findById(TEST_TENANT.id, first.id),
          pending: (yield* (yield* Outbox).pending(10)).length,
        }
      }),
    )
    expect(result.found).toEqual(Option.some(next))
    expect(result.pending).toBe(2)
  })

  it('writes nothing when any version does not match', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* ProcedureRepository
        yield* insert(procedure(1), procedure(2))
        const exit = yield* Effect.exit(
          repository.saveAll(
            [
              { procedure: procedure(1, { name: '바뀜', version: 2 }), expectedVersion: 1 },
              { procedure: procedure(2, { name: '바뀜', version: 3 }), expectedVersion: 2 },
            ],
            [event(procedure(1))],
          ),
        )
        const duplicate = yield* Effect.exit(insert(procedure(1)))
        return {
          exit,
          duplicate,
          names: (yield* repository.listByVisits(TEST_TENANT.id, [VISIT_1])).map((each) => each.name),
          pending: (yield* (yield* Outbox).pending(10)).length,
        }
      }),
    )
    expect(result.exit).toMatchObject(Exit.fail({ _tag: 'VersionMismatch', currentVersion: 1 }))
    expect(result.duplicate).toMatchObject(Exit.fail({ _tag: 'VersionMismatch', currentVersion: 1 }))
    expect(result.names).toEqual(['시술 1', '시술 2'])
    expect(result.pending).toBe(0)
  })

  it('hides and refuses procedures of another tenant', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* ProcedureRepository
        yield* insert(procedure(1))
        const foreign = procedure(1, { tenantId: OTHER_TENANT, version: 2 })
        return {
          found: yield* repository.findById(OTHER_TENANT, procedure(1).id),
          listed: yield* repository.listByVisits(OTHER_TENANT, [VISIT_1]),
          update: yield* Effect.exit(repository.saveAll([{ procedure: foreign, expectedVersion: 1 }])),
          remove: yield* Effect.exit(repository.remove({ ...foreign, version: 1 })),
          kept: yield* repository.findById(TEST_TENANT.id, procedure(1).id),
        }
      }),
    )
    expect(result.found).toEqual(Option.none())
    expect(result.listed).toEqual([])
    expect(result.update).toMatchObject(Exit.fail({ _tag: 'VersionMismatch', currentVersion: 0 }))
    expect(result.remove).toMatchObject(Exit.fail({ _tag: 'VersionMismatch', currentVersion: 0 }))
    expect(result.kept).toEqual(Option.some(procedure(1)))
  })

  it('lists procedures by visit and order', async () => {
    const listed = await run(
      layer(),
      Effect.gen(function* () {
        yield* insert(
          procedure(3, { order: 0 }),
          procedure(1, { order: 1 }),
          procedure(2, { visitId: VISIT_2, order: 0 }),
        )
        const repository = yield* ProcedureRepository
        return {
          both: (yield* repository.listByVisits(TEST_TENANT.id, [VISIT_2, VISIT_1])).map((each) => each.id),
          none: yield* repository.listByVisits(TEST_TENANT.id, []),
        }
      }),
    )
    expect(listed.both).toEqual([procedure(3).id, procedure(1).id, procedure(2).id])
    expect(listed.none).toEqual([])
  })

  it('lists running procedures whose timer ended in every tenant', async () => {
    const due = await run(
      layer(),
      Effect.gen(function* () {
        yield* insert(
          running(1, '2026-11-06T01:00:00.000Z', 60),
          running(2, '2026-11-06T01:00:00.000Z', 600),
          running(3, '2026-11-06T01:00:00.000Z', 30, { tenantId: OTHER_TENANT }),
          procedure(4, {
            status: 'TIMER_ELAPSED',
            startedAt: '2026-11-06T00:00:00.000Z',
            timerEndsAt: '2026-11-06T00:01:00.000Z',
          }),
        )
        return yield* (yield* ProcedureRepository).listDue('2026-11-06T01:01:00.000Z')
      }),
    )
    expect(due.map((each) => each.id)).toEqual([procedure(3).id, procedure(1).id])
  })

  it('removes a procedure of the expected version only', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* ProcedureRepository
        yield* insert(procedure(1))
        const stale = yield* Effect.exit(repository.remove({ ...procedure(1), version: 2 }))
        yield* repository.remove(procedure(1), [event(procedure(1))])
        return {
          stale,
          found: yield* repository.findById(TEST_TENANT.id, procedure(1).id),
          pending: (yield* (yield* Outbox).pending(10)).length,
        }
      }),
    )
    expect(result.stale).toMatchObject(Exit.fail({ _tag: 'VersionMismatch', currentVersion: 1 }))
    expect(result.found).toEqual(Option.none())
    expect(result.pending).toBe(1)
  })
})
