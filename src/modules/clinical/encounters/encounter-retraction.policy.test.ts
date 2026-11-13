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
import { retractCanceledDraft } from './encounter-retraction.policy.ts'
import { EncounterRepository } from './encounter-repository.ts'

const doctor = testMember({ role: 'OWNER_DOCTOR' })

type Services =
  Visits | Patients | VisitRepository | EncounterRepository | Outbox | PolicyCursor | Transaction | CurrentAccess

const run = <A, E>(program: Effect.Effect<A, E, Services>, store: 'memory' | 'sqlite') =>
  Effect.runPromise(
    program.pipe(
      Effect.provideService(CurrentAccess, doctor.access),
      Effect.provide(
        Visits.layer.pipe(
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

const retractedEvents = Effect.gen(function* () {
  return (yield* (yield* Outbox).after(0, 100)).filter((event) => event.type === 'encounter.retracted')
})

describe.each(['memory', 'sqlite'] as const)('빈 초안 철회 정책 (%s)', (store) => {
  it('연쇄가 아닌 취소 뒤 빈 초안을 취소 사유로, 취소한 사람 이름으로 한 번 철회합니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { visit, encounterId } = yield* checkedIn
        yield* (yield* Visits).apply(visit.id, 'CANCEL', { reason: '환자 요청' })
        const before = yield* encounterOf(encounterId)
        yield* runPolicyOnce(retractCanceledDraft)
        yield* runPolicyOnce(retractCanceledDraft)
        return { before, after: yield* encounterOf(encounterId), events: yield* retractedEvents }
      }),
      store,
    )

    expect(result.before).toMatchObject({ status: 'DRAFT', version: 1 })
    expect(result.after).toMatchObject({
      status: 'ENTERED_IN_ERROR',
      retraction: { reason: '환자 요청', retractedBy: doctor.access.userId },
      version: 2,
    })
    expect(result.events).toHaveLength(1)
  })

  it('연쇄 취소가 이미 철회한 진료는 다시 쓰지 않습니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { visit, encounterId } = yield* checkedIn
        yield* (yield* Visits).apply(visit.id, 'CANCEL', { reason: '환자 요청', cascade: true })
        yield* runPolicyOnce(retractCanceledDraft)
        return { after: yield* encounterOf(encounterId), events: yield* retractedEvents }
      }),
      store,
    )

    expect(result.after).toMatchObject({ status: 'ENTERED_IN_ERROR', version: 2 })
    expect(result.events).toHaveLength(1)
  })

  it('취소가 아닌 내원 상태 변경은 지나칩니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { visit, encounterId } = yield* checkedIn
        yield* (yield* Visits).apply(visit.id, 'START_TREATMENT')
        const handled = yield* runPolicyOnce(retractCanceledDraft)
        return { handled, after: yield* encounterOf(encounterId) }
      }),
      store,
    )

    expect(result.handled).toBeGreaterThan(0)
    expect(result.after).toMatchObject({ status: 'DRAFT', version: 1 })
  })
})
