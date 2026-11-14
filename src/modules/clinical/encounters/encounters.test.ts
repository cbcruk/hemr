import { Effect, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import type { Transaction } from '../../../shared/db/transaction.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import { runPolicyOnce } from '../../../shared/events/policy.ts'
import type { PolicyCursor } from '../../../shared/events/policy.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { moveVisitAfterEncounter } from '../../front-desk/visits/visit-after-encounter.policy.ts'
import { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import { Visits } from '../../front-desk/visits/visits.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'
import { Patients } from '../../patients/patients.ts'
import { Encounters } from './encounters.ts'

const doctor = testMember({ role: 'OWNER_DOCTOR' })

type Services = Encounters | Visits | VisitRepository | Patients | Outbox | PolicyCursor | Transaction | CurrentAccess

/** 진료·내원·환자·저장소를 넣어 원장으로 `program`을 실행합니다. */
const run = <A, E>(program: Effect.Effect<A, E, Services>, store: 'memory' | 'sqlite') =>
  Effect.runPromise(
    program.pipe(
      Effect.provideService(CurrentAccess, doctor.access),
      Effect.provide(
        Encounters.layer.pipe(
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
  it('완료는 encounter.completed를 쓰고, 내원 정책이 뒤따라 visit.status_changed를 씁니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { visit, encounterId } = yield* chartedEncounter
        yield* (yield* Encounters).complete(encounterId, { expectedVersion: 2 })
        yield* runPolicyOnce(moveVisitAfterEncounter)
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
      nextVisitStatus: null,
    })
    expect(result.events[4]!.data).toMatchObject({ from: 'WAITING', to: 'IN_TREATMENT' })
  })
})

describe.each(['memory', 'sqlite'] as const)('Encounters.complete visit flow (%s)', (store) => {
  it('수납 완료·지난 날짜의 내원은 완료 뒤에도 내원 정책이 그대로 둡니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const repository = yield* VisitRepository
        const checkedOut = yield* chartedEncounter
        const past = yield* chartedEncounter
        // 수납·지난 날짜를 만드는 커맨드가 아직 없어 저장소에 바로 씁니다
        yield* repository.save({ ...checkedOut.visit, status: 'COMPLETED', version: 2 }, { expectedVersion: 1 })
        yield* repository.save({ ...past.visit, date: '2026-01-01', version: 2 }, { expectedVersion: 1 })
        const encounters = yield* Encounters
        const completed = {
          checkedOut: yield* encounters.complete(checkedOut.encounterId, { expectedVersion: 2 }),
          past: yield* encounters.complete(past.encounterId, { expectedVersion: 2 }),
        }
        yield* runPolicyOnce(moveVisitAfterEncounter)
        return {
          completed,
          checkedOut: Option.getOrThrow(yield* repository.findById(checkedOut.visit.tenantId, checkedOut.visit.id)),
          past: Option.getOrThrow(yield* repository.findById(past.visit.tenantId, past.visit.id)),
        }
      }),
      store,
    )

    expect(result.completed.checkedOut).toEqual({ encounter: expect.objectContaining({ status: 'COMPLETED' }) })
    expect(result.checkedOut).toMatchObject({ status: 'COMPLETED', version: 2 })
    expect(result.past).toMatchObject({ status: 'WAITING', version: 2 })
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
