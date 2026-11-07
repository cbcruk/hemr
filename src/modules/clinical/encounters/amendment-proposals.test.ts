import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { Visits } from '../../front-desk/visits/visits.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'
import { Patients } from '../../patients/patients.ts'
import { Procedures } from '../treatment-room/procedures.ts'
import { AmendmentProposals } from './amendment-proposals.ts'
import { Encounters } from './encounters.ts'

const doctor = testMember({ role: 'OWNER_DOCTOR' })
const desk = testMember({ role: 'FRONT_DESK' })

type Services = AmendmentProposals | Encounters | Visits | Patients | Outbox | CurrentAccess

/** 의사로 `program`을 실행합니다. 데스크의 일은 `asDesk`로 감쌉니다. */
const run = <A, E>(program: Effect.Effect<A, E, Services>, store: 'memory' | 'sqlite') =>
  Effect.runPromise(
    program.pipe(
      Effect.provideService(CurrentAccess, doctor.access),
      Effect.provide(
        AmendmentProposals.layer.pipe(
          Layer.provideMerge(Encounters.layer),
          Layer.provideMerge(Procedures.layer),
          Layer.provideMerge(Visits.layer),
          Layer.provideMerge(Patients.layer),
          Layer.provideMerge(Layer.mergeAll(doctor.seed, desk.seed)),
          Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
          Layer.provideMerge(TestPatientCrypto),
        ),
      ),
    ),
  )

const asDesk = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provideService(effect, CurrentAccess, desk.access)

const acupuncture = {
  kind: 'ACUPUNCTURE',
  feeCode: '40011',
  categoryCode: '33001001',
  name: '침술',
  dose: { perDay: 1, days: 1 },
  unitPrice: 4_210,
} as const

/** 접수하고 주상병을 저장해 완료한 진료(버전 3, 1판)입니다. */
const completedEncounter = Effect.gen(function* () {
  const patient = yield* (yield* Patients).register({ name: '홍길동' })
  const visit = yield* (yield* Visits).checkIn({ patientId: patient.id, coverage: 'SELF_PAY' })
  const encounterId = visit.encounterId as Id<'encounter'>
  const encounters = yield* Encounters
  yield* encounters.update(
    encounterId,
    { diagnoses: { upsert: [{ code: 'U23.4', kind: 'PRIMARY' }] } },
    { expectedVersion: 1 },
  )
  yield* encounters.complete(encounterId, { expectedVersion: 2 })
  return encounterId
})

describe.each(['memory', 'sqlite'] as const)('AmendmentProposals (%s)', (store) => {
  it('applies a prescription line proposal with its client refs and writes the events', async () => {
    const result = await run(
      Effect.gen(function* () {
        const encounterId = yield* completedEncounter
        const proposals = yield* AmendmentProposals
        const proposal = yield* asDesk(
          proposals.propose(encounterId, {
            reason: '침술 누락',
            changes: { prescriptionLines: { upsert: [{ ...acupuncture, clientRef: 'row-1', prn: false }] } },
          }),
        )
        const dismissed = yield* asDesk(
          proposals.propose(encounterId, { reason: '본문', changes: { note: { body: '<p>요통</p>' } } }),
        )
        yield* proposals.dismiss(dismissed.id, '불필요')
        const applied = yield* proposals.apply(proposal.id, {})
        const events = (yield* (yield* Outbox).pending(50)).map((row) => row.event)
        return { encounterId, proposal, dismissed, applied, events }
      }),
      store,
    )

    const line = result.applied.encounter.prescriptionLines[0]!
    expect(line).toMatchObject({ name: '침술', prn: false })
    expect(result.applied.prescriptionLineRefs).toEqual([{ clientRef: 'row-1', id: line.id }])
    expect(result.applied.proposal).toMatchObject({ status: 'APPLIED', resolution: { revision: 2 } })

    const ofProposals = result.events.filter((each) => each.type.startsWith('amendment_proposal.'))
    expect(ofProposals.map((each) => [each.type, each.data['proposalId']])).toEqual([
      ['amendment_proposal.created', result.proposal.id],
      ['amendment_proposal.created', result.dismissed.id],
      ['amendment_proposal.dismissed', result.dismissed.id],
      ['amendment_proposal.applied', result.proposal.id],
    ])
    expect(ofProposals[0]!.actor).toEqual({ kind: 'USER', id: desk.access.userId })
    expect(ofProposals[3]!.actor).toEqual({ kind: 'USER', id: doctor.access.userId })
    const amended = result.events.find((each) => each.type === 'encounter.amended')!
    expect(amended.data).toMatchObject({
      encounterId: result.encounterId,
      revision: 2,
      reason: '침술 누락',
      proposalId: result.proposal.id,
    })
  })

  it('refuses a proposal on a retracted encounter', async () => {
    const result = await run(
      Effect.gen(function* () {
        const encounterId = yield* completedEncounter
        yield* (yield* Encounters).retract(encounterId, { reason: '잘못 연 진료', expectedVersion: 3 })
        return yield* Effect.flip(
          asDesk(
            (yield* AmendmentProposals).propose(encounterId, {
              reason: '상병',
              changes: { note: { body: '<p>요통</p>' } },
            }),
          ),
        )
      }),
      store,
    )
    expect(result).toMatchObject({ code: 'ENCOUNTER_NOT_EDITABLE', currentStatus: 'ENTERED_IN_ERROR' })
  })
})
