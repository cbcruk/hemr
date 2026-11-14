import { Effect, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import type { Transaction } from '../../../shared/db/transaction.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import { runPolicyOnce } from '../../../shared/events/policy.ts'
import type { PolicyCursor } from '../../../shared/events/policy.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import { Visits } from '../../front-desk/visits/visits.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'
import { Patients } from '../../patients/patients.ts'
import { createVisitDraft } from './encounter-draft.policy.ts'
import { Encounters } from './encounters.ts'
import { Procedures } from '../treatment-room/procedures.ts'
import { EncounterRepository } from './encounter-repository.ts'

const doctor = testMember({ role: 'OWNER_DOCTOR' })

type Services =
  | Encounters
  | Visits
  | Patients
  | VisitRepository
  | EncounterRepository
  | Outbox
  | PolicyCursor
  | Transaction
  | CurrentAccess

const run = <A, E>(program: Effect.Effect<A, E, Services>, store: 'memory' | 'sqlite') =>
  Effect.runPromise(
    program.pipe(
      Effect.provideService(CurrentAccess, doctor.access),
      Effect.provide(
        Encounters.layer.pipe(
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

/** 접수한 내원과 그 빈 초안 진료입니다. */
const checkedIn = Effect.gen(function* () {
  const patient = yield* (yield* Patients).register({ name: '홍길동' })
  const visit = yield* (yield* Visits).checkIn({ patientId: patient.id, coverage: 'SELF_PAY' })
  return { visit, encounterId: visit.encounterId as Id<'encounter'> }
})

const encounterOf = (encounterId: Id<'encounter'>) =>
  Effect.gen(function* () {
    return Option.getOrThrow(yield* (yield* EncounterRepository).findById(doctor.access.tenantId, encounterId))
  })

const createdEvents = Effect.gen(function* () {
  return (yield* (yield* Outbox).after(0, 100)).filter((event) => event.type === 'encounter.created')
})

describe.each(['memory', 'sqlite'] as const)('진료 초안 만들기 정책 (%s)', (store) => {
  it('접수한 내원의 진료 ID로 초안을 한 번 만듭니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { visit, encounterId } = yield* checkedIn
        yield* runPolicyOnce(createVisitDraft)
        yield* runPolicyOnce(createVisitDraft)
        return { visit, encounter: yield* encounterOf(encounterId), events: yield* createdEvents }
      }),
      store,
    )

    expect(result.encounter).toMatchObject({ visitId: result.visit.id, status: 'DRAFT', version: 1 })
    expect(result.events).toHaveLength(1)
  })

  it('정책보다 먼저 진료를 열면 그때 만들고, 정책은 다시 만들지 않습니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { encounterId } = yield* checkedIn
        const opened = yield* (yield* Encounters).get(encounterId)
        yield* runPolicyOnce(createVisitDraft)
        return { opened, after: yield* encounterOf(encounterId), events: yield* createdEvents }
      }),
      store,
    )

    expect(result.opened).toMatchObject({ status: 'DRAFT', version: 1 })
    expect(result.after).toEqual(result.opened)
    expect(result.events).toHaveLength(1)
  })

  it('정책이 돌기 전에 취소한 내원은 초안을 만들지 않습니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { visit, encounterId } = yield* checkedIn
        yield* (yield* Visits).apply(visit.id, 'CANCEL', { reason: '환자 요청' })
        yield* runPolicyOnce(createVisitDraft)
        return {
          stored: yield* (yield* EncounterRepository).findById(doctor.access.tenantId, encounterId),
          events: yield* createdEvents,
        }
      }),
      store,
    )

    expect(result.stored).toEqual(Option.none())
    expect(result.events).toEqual([])
  })
})
