import { Effect, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import { TEST_TENANT } from '../../identity/auth/testing.ts'
import type { Encounter } from './encounter.ts'
import { EncounterRepository } from './encounter-repository.ts'

const OTHER_TENANT = 'ten_01JBQ000000000000000000002' as Encounter['tenantId']
const PATIENT = 'pat_01JBQ000000000000000000001' as Encounter['patientId']

const encounter = (n: number, overrides: Partial<Encounter> = {}): Encounter => ({
  id: `enc_01JBQ00000000000000000000${n}` as Encounter['id'],
  tenantId: TEST_TENANT.id,
  patientId: PATIENT,
  visitId: `vis_01JBQ00000000000000000000${n}` as Encounter['visitId'],
  doctorId: null,
  encounterType: 'OFFICE',
  coverage: 'SELF_PAY',
  serviceAt: `2026-11-0${n}T00:00:00.000Z`,
  note: { body: '' },
  diagnoses: [],
  prescriptionLines: [],
  benefitFlags: { fullSelfPay: false, pregnant: false },
  status: 'DRAFT',
  completedAt: null,
  createdAt: `2026-11-0${n}T00:00:00.000Z`,
  updatedAt: `2026-11-0${n}T00:00:00.000Z`,
  version: 1,
  ...overrides,
})

const run = <A, E>(
  layer: Layer.Layer<EncounterRepository | Outbox, unknown>,
  program: Effect.Effect<A, E, EncounterRepository | Outbox>,
) => Effect.runPromise(program.pipe(Effect.provide(layer)))

/** 메모리와 SQLite 구현이 같은 계약을 지키는지 봅니다. */
describe.each([
  ['memory', () => PersistenceMemory()],
  ['sqlite', () => PersistenceSqlite(':memory:')],
] as const)('EncounterRepository (%s)', (_, layer) => {
  it('inserts, updates with the expected version and keeps the content', async () => {
    const first = encounter(1)
    const next: Encounter = {
      ...first,
      doctorId: 'usr_01JBQ000000000000000000001' as Encounter['doctorId'],
      note: { body: '<p>요통</p>' },
      diagnoses: [
        { id: 'dx_01JBQ000000000000000000001' as Encounter['diagnoses'][number]['id'], code: 'U23.4', kind: 'PRIMARY' },
      ],
      prescriptionLines: [
        {
          id: 'pl_01JBQ000000000000000000001' as Encounter['prescriptionLines'][number]['id'],
          kind: 'HERBAL',
          feeCode: null,
          categoryCode: '39001001',
          name: '첩약',
          dose: { perDay: 0.5, days: 3 },
          unitPrice: 12_345.5,
          amount: 18_518,
          prn: true,
        },
      ],
      updatedAt: '2026-11-01T01:00:00.000Z',
      version: 2,
    }
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* EncounterRepository
        yield* repository.save(first, { expectedVersion: null })
        const event = domainEvent('encounter.updated', first.id, next.updatedAt, { encounterId: first.id })
        yield* repository.save(next, { expectedVersion: 1, events: [event] })
        const stale = yield* Effect.flip(repository.save({ ...next, version: 3 }, { expectedVersion: 1 }))
        const duplicate = yield* Effect.flip(repository.save(first, { expectedVersion: null }))
        return {
          found: yield* repository.findById(TEST_TENANT.id, first.id),
          stale,
          duplicate,
          pending: (yield* (yield* Outbox).pending(10)).map((row) => row.event.type),
        }
      }),
    )
    expect(result.found).toEqual(Option.some(next))
    expect(result.stale).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 2 })
    expect(result.duplicate).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 2 })
    expect(result.pending).toEqual(['encounter.updated'])
  })

  it('lists a patient newest first and hides other tenants', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* EncounterRepository
        for (const each of [
          encounter(1),
          encounter(3),
          encounter(2),
          encounter(4, { patientId: 'pat_01JBQ000000000000000000002' as Encounter['patientId'] }),
          encounter(5, { tenantId: OTHER_TENANT }),
        ]) {
          yield* repository.save(each, { expectedVersion: null })
        }
        return {
          listed: (yield* repository.listByPatient(TEST_TENANT.id, PATIENT)).map((each) => each.id.slice(-1)),
          hidden: yield* repository.findById(OTHER_TENANT, encounter(1).id),
          intruder: yield* Effect.flip(
            repository.save({ ...encounter(1), tenantId: OTHER_TENANT, version: 2 }, { expectedVersion: 1 }),
          ),
        }
      }),
    )
    expect(result.listed).toEqual(['3', '2', '1'])
    expect(Option.isNone(result.hidden)).toBe(true)
    expect(result.intruder).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 0 })
  })
})
