import { Effect, Exit, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import type { Visit } from './visit.ts'
import { VisitRepository } from './visit-repository.ts'
import { Visits } from './visits.ts'

const visit: Visit = {
  id: 'vis_01JBQ000000000000000000001' as Visit['id'],
  patientId: 'pat_01JBQ000000000000000000001' as Visit['patientId'],
  date: clinicDate(Date.now()),
  status: 'COMPLETED',
  statusChangedAt: '2026-11-05T00:00:00.000Z',
  hasClinicalData: false,
  version: 1,
}

const run = <A, E>(program: Effect.Effect<A, E, Visits | Outbox>) =>
  Effect.runPromise(program.pipe(Effect.provide(Visits.layer.pipe(Layer.provideMerge(PersistenceMemory([visit]))))))

describe('Visits.apply', () => {
  it('writes one status_changed event from the first to the last status', async () => {
    const pending = await run(
      Effect.gen(function* () {
        yield* (yield* Visits).apply(visit.id, 'REOPEN', { reason: '재수납', then: 'WAITING' })
        return yield* (yield* Outbox).pending(10)
      }),
    )
    expect(pending.map((row) => [row.event.type, row.event.subject, row.event.data])).toEqual([
      [
        'visit.status_changed',
        visit.id,
        { visitId: visit.id, patientId: visit.patientId, from: 'COMPLETED', to: 'WAITING' },
      ],
    ])
  })

  it('writes no event when the command is rejected', async () => {
    const pending = await run(
      Effect.gen(function* () {
        yield* Effect.flip((yield* Visits).apply(visit.id, 'START_TREATMENT'))
        return yield* (yield* Outbox).pending(10)
      }),
    )
    expect(pending).toEqual([])
  })
})

describe('Visits.apply under concurrency', () => {
  const waiting: Visit = { ...visit, status: 'WAITING' }

  /** 첫 저장 직전에 다른 요청이 먼저 저장해 버전을 올린 것처럼 만드는 저장소입니다. */
  const racing = () => {
    const inner = VisitRepository.layerMemory([waiting]).pipe(Layer.provide(Outbox.layerMemory))
    return Layer.effect(
      VisitRepository,
      Effect.gen(function* () {
        const repository = yield* VisitRepository
        let raced = false
        return VisitRepository.of({
          findById: repository.findById,
          save: (next, options) =>
            Effect.gen(function* () {
              if (!raced) {
                raced = true
                const current = Option.getOrThrow(yield* repository.findById(next.id))
                yield* repository.save(
                  { ...current, version: current.version + 1 },
                  { expectedVersion: current.version },
                )
              }
              yield* repository.save(next, options)
            }),
        })
      }),
    ).pipe(Layer.provide(inner), Layer.provideMerge(Outbox.layerMemory))
  }

  const runWith = <A, E>(
    layer: Layer.Layer<VisitRepository | Outbox, unknown>,
    program: Effect.Effect<A, E, Visits | Outbox>,
  ) => Effect.runPromise(program.pipe(Effect.provide(Visits.layer.pipe(Layer.provideMerge(layer)))))

  it('retries a lost race when the client sent no version', async () => {
    const result = await runWith(
      racing(),
      Effect.gen(function* () {
        const next = yield* (yield* Visits).apply(waiting.id, 'START_TREATMENT')
        return { next, pending: yield* (yield* Outbox).pending(10) }
      }),
    )
    expect(result.next).toMatchObject({ status: 'IN_TREATMENT', version: 3 })
    expect(result.pending).toHaveLength(1)
  })

  it('reports a lost race when the client sent a version', async () => {
    const result = await runWith(
      racing(),
      Effect.gen(function* () {
        const error = yield* Effect.flip((yield* Visits).apply(waiting.id, 'START_TREATMENT', { expectedVersion: 1 }))
        return { error, pending: yield* (yield* Outbox).pending(10) }
      }),
    )
    expect(result.error).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 2 })
    expect(result.pending).toEqual([])
  })

  it('lets only one of two concurrent versioned commands win on SQLite', async () => {
    const seeded = Layer.effectDiscard(
      Effect.gen(function* () {
        yield* (yield* VisitRepository).save(waiting, { expectedVersion: null })
      }),
    ).pipe(Layer.provideMerge(PersistenceSqlite(':memory:')))
    const result = await runWith(
      seeded,
      Effect.gen(function* () {
        const visits = yield* Visits
        const exits = yield* Effect.all(
          [
            Effect.exit(visits.apply(waiting.id, 'START_TREATMENT', { expectedVersion: 1 })),
            Effect.exit(visits.apply(waiting.id, 'CANCEL', { expectedVersion: 1, reason: '취소' })),
          ],
          { concurrency: 'unbounded' },
        )
        return { exits, pending: yield* (yield* Outbox).pending(10) }
      }),
    )
    expect(result.exits.filter(Exit.isSuccess)).toHaveLength(1)
    expect(result.pending).toHaveLength(1)
  })
})
