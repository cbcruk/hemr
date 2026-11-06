import { Effect, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { EncounterRepository } from '../../clinical/encounters/encounter-repository.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'
import { Patients } from '../../patients/patients.ts'
import { Visits } from '../visits/visits.ts'
import { Receipts } from './receipts.ts'

const desk = testMember({ role: 'FRONT_DESK' })

type Services = Receipts | Visits | Patients | EncounterRepository | Outbox | CurrentAccess

const run = <A, E>(program: Effect.Effect<A, E, Services>, store: 'memory' | 'sqlite') =>
  Effect.runPromise(
    program.pipe(
      Effect.provideService(CurrentAccess, desk.access),
      Effect.provide(
        Receipts.layer.pipe(
          Layer.provideMerge(Visits.layer),
          Layer.provideMerge(Patients.layer),
          Layer.provideMerge(desk.seed),
          Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
          Layer.provideMerge(TestPatientCrypto),
        ),
      ),
    ),
  )

const checkedIn = Effect.gen(function* () {
  const patient = yield* (yield* Patients).register({ name: '홍길동' })
  return yield* (yield* Visits).checkIn({ patientId: patient.id, coverage: 'SELF_PAY' })
})

describe.each(['memory', 'sqlite'] as const)('Receipts (%s)', (store) => {
  it('writes receipt.created and visit.status_changed with the checkout', async () => {
    const events = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const receipts = yield* Receipts
        const quote = yield* receipts.quote(visit.id, {})
        const { receipt } = yield* receipts.checkout(visit.id, { quoteId: quote.quoteId, idempotencyKey: 'k' })
        const pending = yield* (yield* Outbox).pending(100)
        return {
          receiptId: receipt.id,
          events: pending
            .map((row) => row.event)
            .filter((event) => event.type === 'receipt.created' || event.type === 'visit.status_changed'),
        }
      }),
      store,
    )
    expect(events.events.map((event) => [event.type, event.data])).toEqual([
      ['visit.status_changed', expect.objectContaining({ from: 'WAITING', to: 'COMPLETED' })],
      [
        'receipt.created',
        expect.objectContaining({ receiptId: events.receiptId, total: 0, result: 'PAID', acknowledged: [] }),
      ],
    ])
  })

  it('refuses insured encounters with prescriptions until copay can be calculated', async () => {
    const error = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const encounters = yield* EncounterRepository
        const encounterId = visit.encounterId as Id<'encounter'>
        const encounter = Option.getOrThrow(yield* encounters.findById(visit.tenantId, encounterId))
        yield* encounters.save(
          {
            ...encounter,
            coverage: 'NHIS',
            prescriptionLines: [
              {
                id: 'pl_01JBQ000000000000000000001' as Id<'prescriptionLine'>,
                kind: 'ACUPUNCTURE',
                feeCode: '40011',
                categoryCode: '33001001',
                name: '침술',
                dose: { perDay: 1, days: 1 },
                unitPrice: 4_210,
                amount: 4_210,
                prn: false,
              },
            ],
            version: encounter.version + 1,
          },
          { expectedVersion: encounter.version },
        )
        return yield* Effect.flip((yield* Receipts).quote(visit.id, {}))
      }),
      store,
    )
    expect(error).toMatchObject({ code: 'CHECKOUT_COVERAGE_UNSUPPORTED' })
  })
})
