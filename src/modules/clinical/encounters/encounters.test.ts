import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import { Visits } from '../../front-desk/visits/visits.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'
import { Patients } from '../../patients/patients.ts'
import { Encounters } from './encounters.ts'
import { Procedures } from '../treatment-room/procedures.ts'

const doctor = testMember({ role: 'OWNER_DOCTOR' })

type Services = Encounters | Visits | VisitRepository | Patients | Outbox | CurrentAccess

/** 진료·내원·환자·저장소를 넣어 원장으로 `program`을 실행합니다. */
const run = <A, E>(
  program: Effect.Effect<A, E, Services>,
  store: 'memory' | 'sqlite',
  visitRepository?: Layer.Layer<VisitRepository, never, VisitRepository>,
) =>
  Effect.runPromise(
    program.pipe(
      Effect.provideService(CurrentAccess, doctor.access),
      Effect.provide(
        // 진료가 쓰는 내원 저장소만 `visitRepository`로 바꿀 수 있습니다. 접수는 늘 원래 저장소입니다
        (visitRepository === undefined ? Encounters.layer : Encounters.layer.pipe(Layer.provide(visitRepository))).pipe(
          Layer.provideMerge(Procedures.layer),
          Layer.provideMerge(Visits.layer),
          Layer.provideMerge(Patients.layer),
          Layer.provideMerge(doctor.seed),
          Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
          Layer.provideMerge(TestPatientCrypto),
        ),
      ),
    ),
  )

/** 접수하고 주상병을 저장해, 완료할 수 있는 진료(버전 2)를 만듭니다. */
const chartedEncounter = Effect.gen(function* () {
  const patient = yield* (yield* Patients).register({ name: '홍길동' })
  const visit = yield* (yield* Visits).checkIn({ patientId: patient.id, coverage: 'SELF_PAY' })
  const encounterId = visit.encounterId as Id<'encounter'>
  yield* (yield* Encounters).update(
    encounterId,
    { diagnoses: { upsert: [{ code: 'U23.4', kind: 'PRIMARY' }] } },
    { expectedVersion: 1 },
  )
  return { visit, encounterId }
})

describe.each(['memory', 'sqlite'] as const)('Encounters.complete (%s)', (store) => {
  it('writes encounter.completed and visit.status_changed', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { visit, encounterId } = yield* chartedEncounter
        yield* (yield* Encounters).complete(encounterId, { expectedVersion: 2 })
        const pending = yield* (yield* Outbox).pending(20)
        return {
          visit,
          encounterId,
          events: pending.map((row) => row.event).filter((each) => each.type !== 'patient.created'),
        }
      }),
      store,
    )

    expect(result.events.map((each) => each.type)).toEqual([
      'visit.checked_in',
      'encounter.created',
      'encounter.updated',
      'encounter.completed',
      'visit.status_changed',
    ])
    expect(result.events[3]!.data).toEqual({
      encounterId: result.encounterId,
      visitId: result.visit.id,
      patientId: result.visit.patientId,
      doctorId: doctor.user.id,
      acknowledged: [],
    })
    expect(result.events[4]!.data).toMatchObject({ from: 'WAITING', to: 'IN_TREATMENT' })
  })
})

describe.each(['memory', 'sqlite'] as const)('Encounters.complete visit flow (%s)', (store) => {
  it('leaves checked-out and past-date visits where they are', async () => {
    const result = await run(
      Effect.gen(function* () {
        const repository = yield* VisitRepository
        const checkedOut = yield* chartedEncounter
        const past = yield* chartedEncounter
        // 수납·지난 날짜를 만드는 커맨드가 아직 없어 저장소에 바로 씁니다
        yield* repository.save({ ...checkedOut.visit, status: 'COMPLETED', version: 2 }, { expectedVersion: 1 })
        yield* repository.save({ ...past.visit, date: '2026-01-01', version: 2 }, { expectedVersion: 1 })
        const encounters = yield* Encounters
        return {
          checkedOut: yield* encounters.complete(checkedOut.encounterId, { expectedVersion: 2 }),
          past: yield* encounters.complete(past.encounterId, { expectedVersion: 2 }),
        }
      }),
      store,
    )

    expect(result.checkedOut).toMatchObject({
      encounter: { status: 'COMPLETED' },
      visit: { status: 'COMPLETED', version: 2 },
    })
    expect(result.past).toMatchObject({ encounter: { status: 'COMPLETED' }, visit: { status: 'WAITING', version: 2 } })
  })
})

describe('Encounters on a visit canceled before cancel retracted encounters', () => {
  it('refuses to save or complete the draft', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { visit, encounterId } = yield* chartedEncounter
        // #25 전에 취소한 내원은 진료를 철회하지 않았습니다
        yield* (yield* VisitRepository).save({ ...visit, status: 'CANCELED', version: 2 }, { expectedVersion: 1 })
        const encounters = yield* Encounters
        return {
          update: yield* Effect.flip(encounters.update(encounterId, { note: { body: 'x' } }, { expectedVersion: 2 })),
          complete: yield* Effect.flip(encounters.complete(encounterId, { expectedVersion: 2 })),
        }
      }),
      'memory',
    )

    expect(result.update).toMatchObject({ code: 'ENCOUNTER_VISIT_CANCELED' })
    expect(result.complete).toMatchObject({ code: 'ENCOUNTER_VISIT_CANCELED' })
  })
})

describe('Encounters.complete (sqlite)', () => {
  it('rolls the completion back when moving the visit fails', async () => {
    const failing = Layer.effect(
      VisitRepository,
      Effect.gen(function* () {
        const inner = yield* VisitRepository
        return VisitRepository.of({ ...inner, save: () => Effect.die('visit move failed') })
      }),
    )
    const result = await run(
      Effect.gen(function* () {
        const { encounterId } = yield* chartedEncounter
        const exit = yield* Effect.exit((yield* Encounters).complete(encounterId, { expectedVersion: 2 }))
        const pending = yield* (yield* Outbox).pending(20)
        return {
          exit,
          encounter: yield* (yield* Encounters).get(encounterId),
          pending: pending.map((row) => row.event.type),
        }
      }),
      'sqlite',
      failing,
    )

    expect(result.exit._tag).toBe('Failure')
    expect(result.encounter).toMatchObject({ status: 'DRAFT', completedAt: null, version: 2 })
    expect(result.pending).not.toContain('encounter.completed')
  })
})
