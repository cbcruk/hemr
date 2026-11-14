import { Effect, Exit, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import { TEST_TENANT } from '../../identity/auth/testing.ts'
import type { Procedure } from './procedure.ts'
import { ProcedureRepository } from './procedure-repository.ts'
import type { TreatmentSessionWrite } from './procedure-repository.ts'

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

const AT = '2026-11-06T01:00:00.000Z'

/** 세션에 쓸 것입니다. 기본은 첫 내원의 세션에 바뀐 시술 없이 씁니다. */
const write = (overrides: Partial<TreatmentSessionWrite> = {}): TreatmentSessionWrite => ({
  tenantId: TEST_TENANT.id,
  visitId: VISIT_1,
  expectedVersion: 0,
  at: AT,
  procedures: [],
  removed: [],
  ...overrides,
})

/** 시술을 그 세션의 지금 버전으로 씁니다. */
const insert = (...procedures: Procedure[]) =>
  Effect.gen(function* () {
    const repository = yield* ProcedureRepository
    for (const each of procedures) {
      const session = yield* repository.findSession(each.tenantId, each.visitId)
      yield* repository.saveSession(
        write({ tenantId: each.tenantId, visitId: each.visitId, expectedVersion: session.version, procedures: [each] }),
      )
    }
  })

/** 메모리와 SQLite 구현이 같은 계약을 지키는지 봅니다. */
describe.each([
  ['memory', () => PersistenceMemory()],
  ['sqlite', () => PersistenceSqlite(':memory:')],
] as const)('ProcedureRepository (%s)', (_, layer) => {
  it('세션 버전을 비교해 올리고 시술과 이벤트를 함께 씁니다', async () => {
    const first = procedure(1)
    const next = running(1, AT, 600, { updatedAt: AT, version: 2 })
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* ProcedureRepository
        const empty = yield* repository.findSession(TEST_TENANT.id, VISIT_1)
        yield* repository.saveSession(write({ procedures: [first] }), [event(first)])
        yield* repository.saveSession(write({ expectedVersion: 1, procedures: [next] }), [event(next)])
        return {
          empty,
          session: yield* repository.findSession(TEST_TENANT.id, VISIT_1),
          found: yield* repository.findById(TEST_TENANT.id, first.id),
          pending: (yield* (yield* Outbox).pending(10)).length,
        }
      }),
    )
    expect(result.empty).toEqual({ tenantId: TEST_TENANT.id, visitId: VISIT_1, version: 0, procedures: [] })
    expect(result.session).toEqual({ tenantId: TEST_TENANT.id, visitId: VISIT_1, version: 2, procedures: [next] })
    expect(result.found).toEqual(Option.some(next))
    expect(result.pending).toBe(2)
  })

  it('세션 버전이 어긋나면 아무것도 쓰지 않습니다', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* ProcedureRepository
        yield* insert(procedure(1), procedure(2))
        const stale = yield* Effect.exit(
          repository.saveSession(
            write({
              expectedVersion: 1,
              procedures: [procedure(1, { name: '바뀜', version: 2 })],
              removed: [procedure(2).id],
            }),
            [event(procedure(1))],
          ),
        )
        const fresh = yield* Effect.exit(repository.saveSession(write({ procedures: [procedure(3)] })))
        return {
          stale,
          fresh,
          session: yield* repository.findSession(TEST_TENANT.id, VISIT_1),
          pending: (yield* (yield* Outbox).pending(10)).length,
        }
      }),
    )
    expect(result.stale).toMatchObject(Exit.fail({ _tag: 'VersionMismatch', currentVersion: 2 }))
    expect(result.fresh).toMatchObject(Exit.fail({ _tag: 'VersionMismatch', currentVersion: 2 }))
    expect(result.session.version).toBe(2)
    expect(result.session.procedures.map((each) => each.name)).toEqual(['시술 1', '시술 2'])
    expect(result.pending).toBe(0)
  })

  it('세션 안의 시술을 지웁니다', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* ProcedureRepository
        yield* insert(procedure(1), procedure(2))
        yield* repository.saveSession(write({ expectedVersion: 2, removed: [procedure(1).id] }), [event(procedure(1))])
        return {
          session: yield* repository.findSession(TEST_TENANT.id, VISIT_1),
          pending: (yield* (yield* Outbox).pending(10)).length,
        }
      }),
    )
    expect(result.session).toMatchObject({ version: 3, procedures: [{ id: procedure(2).id }] })
    expect(result.pending).toBe(1)
  })

  it('다른 병원의 세션과 시술은 보이지 않고, 지우지도 않습니다', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* ProcedureRepository
        yield* insert(procedure(1))
        yield* repository.saveSession(write({ tenantId: OTHER_TENANT, removed: [procedure(1).id] }))
        return {
          found: yield* repository.findById(OTHER_TENANT, procedure(1).id),
          session: yield* repository.findSession(OTHER_TENANT, VISIT_1),
          listed: yield* repository.listByVisits(OTHER_TENANT, [VISIT_1]),
          kept: yield* repository.findById(TEST_TENANT.id, procedure(1).id),
        }
      }),
    )
    expect(result.found).toEqual(Option.none())
    expect(result.session).toMatchObject({ version: 1, procedures: [] })
    expect(result.listed).toEqual([])
    expect(result.kept).toEqual(Option.some(procedure(1)))
  })

  it('다른 세션의 시술 ID를 쓰면 결함입니다', async () => {
    const exit = await run(
      layer(),
      Effect.gen(function* () {
        yield* insert(procedure(1))
        return yield* Effect.exit(
          (yield* ProcedureRepository).saveSession(
            write({ visitId: VISIT_2, procedures: [procedure(1, { visitId: VISIT_2 })] }),
          ),
        )
      }),
    )
    expect(Exit.isFailure(exit) && exit.cause.reasons.some((reason) => reason._tag === 'Die')).toBe(true)
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
})
