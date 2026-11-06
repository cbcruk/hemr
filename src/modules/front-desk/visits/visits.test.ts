import { Effect, Exit, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { TEST_TENANT, testMember } from '../../identity/auth/testing.ts'
import { IdentityRepository } from '../../identity/identity-repository.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'
import { PatientRepository } from '../../patients/patient-repository.ts'
import { Patients } from '../../patients/patients.ts'
import { AccessLog } from '../../../shared/audit/access-log.ts'
import type { Visit } from './visit.ts'
import { VisitRepository } from './visit-repository.ts'
import { Visits } from './visits.ts'
import { testVisit } from './testing.ts'

const visit = testVisit({ status: 'COMPLETED' })

const owner = testMember()

/**
 * `persistence`의 내원 저장소·outbox로 `Visits`를 만듭니다. 접수가 읽는 환자·병원 저장소는 따로 메모리에 둡니다.
 */
const visitsWith = (persistence: Layer.Layer<VisitRepository | Outbox, unknown>) =>
  Visits.layer.pipe(
    Layer.provide(Patients.layer),
    Layer.provideMerge(persistence),
    Layer.provide(
      Layer.mergeAll(IdentityRepository.layerMemory, PatientRepository.layerMemory, AccessLog.layerMemory).pipe(
        Layer.provide(Outbox.layerMemory),
      ),
    ),
    Layer.provide(TestPatientCrypto),
  )

const run = <A, E>(program: Effect.Effect<A, E, Visits | Outbox | CurrentAccess>, access = owner.access) =>
  Effect.runPromise(
    program.pipe(Effect.provideService(CurrentAccess, access), Effect.provide(visitsWith(PersistenceMemory([visit])))),
  )

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

  it('records the tenant and the user on the event', async () => {
    const pending = await run(
      Effect.gen(function* () {
        yield* (yield* Visits).apply(visit.id, 'REOPEN', { reason: '재수납' })
        return yield* (yield* Outbox).pending(10)
      }),
    )
    expect(pending.map((row) => [row.event.tenantId, row.event.actor])).toEqual([
      [TEST_TENANT.id, { kind: 'USER', id: owner.user.id }],
    ])
  })

  it('does not find a visit of another tenant', async () => {
    const other = testMember({ tenant: { ...TEST_TENANT, id: 'ten_01JBQ000000000000000000002' as Visit['tenantId'] } })
    const error = await run(
      Effect.gen(function* () {
        return yield* Effect.flip((yield* Visits).apply(visit.id, 'REOPEN', { reason: '재수납' }))
      }),
      other.access,
    )
    expect(error).toMatchObject({ code: 'VISIT_NOT_FOUND' })
  })

  it('needs visit:cancel, receipt:void and encounter:retract for a cascade cancel (D3)', async () => {
    const desk = testMember({ role: 'FRONT_DESK' })
    const result = await run(
      Effect.gen(function* () {
        const visits = yield* Visits
        return {
          cascade: yield* Effect.flip(visits.apply(visit.id, 'CANCEL', { reason: '취소', cascade: true })),
          pending: yield* (yield* Outbox).pending(10),
        }
      }),
      desk.access,
    )
    expect(result.cascade).toMatchObject({ code: 'PERMISSION_DENIED', missing: ['encounter:retract'] })
    expect(result.pending).toEqual([])
  })

  it('checks all three cascade permissions itself, not only those the endpoint declares', async () => {
    const error = await run(
      Effect.gen(function* () {
        return yield* Effect.flip((yield* Visits).apply(visit.id, 'CANCEL', { reason: '취소', cascade: true }))
      }),
      testMember({ role: 'THERAPIST' }).access,
    )
    expect(error).toMatchObject({ missing: ['visit:cancel', 'receipt:void', 'encounter:retract'] })
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
          ...repository,
          save: (next, options) =>
            Effect.gen(function* () {
              if (!raced) {
                raced = true
                const current = Option.getOrThrow(yield* repository.findById(next.tenantId, next.id))
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
    program: Effect.Effect<A, E, Visits | Outbox | CurrentAccess>,
  ) =>
    Effect.runPromise(
      program.pipe(Effect.provideService(CurrentAccess, owner.access), Effect.provide(visitsWith(layer))),
    )

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
