import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteClient, SqliteMigrator } from '@effect/sql-sqlite-node'
import { Effect, Exit, Layer, Option } from 'effect'
import { SqlClient } from 'effect/sql'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { migrations } from '../../../shared/db/migrations.ts'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import { testVisit } from '../../front-desk/visits/testing.ts'
import { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import { TEST_TENANT } from '../../identity/auth/testing.ts'
import type { Encounter, EncounterRevision } from './encounter.ts'
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
  revision: 0,
  locked: false,
  retraction: null,
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

const revision = (n: number, overrides: Partial<EncounterRevision> = {}): EncounterRevision => ({
  encounterId: encounter(1).id,
  revision: n,
  note: { body: `<p>${n}판</p>` },
  diagnoses: [],
  prescriptionLines: [],
  source: n === 1 ? 'COMPLETION' : 'AMENDMENT',
  reason: n === 1 ? null : '정정',
  recordedBy: 'usr_01JBQ000000000000000000001' as EncounterRevision['recordedBy'],
  recordedAt: `2026-11-0${n}T00:00:00.000Z`,
  ...overrides,
})

describe.each([
  ['memory', () => PersistenceMemory()],
  ['sqlite', () => PersistenceSqlite(':memory:')],
] as const)('EncounterRepository revisions (%s)', (_, layer) => {
  it('appends a revision with each save that carries one, oldest first, and hides other tenants', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* EncounterRepository
        yield* repository.save(encounter(1), { expectedVersion: null })
        yield* repository.save({ ...encounter(1), version: 2 }, { expectedVersion: 1, revision: revision(1) })
        yield* repository.save({ ...encounter(1), version: 3 }, { expectedVersion: 2 })
        yield* repository.save({ ...encounter(1), version: 4 }, { expectedVersion: 3, revision: revision(2) })
        // 버전이 어긋나 거절한 저장은 판도 남기지 않습니다
        yield* Effect.flip(
          repository.save({ ...encounter(1), version: 9 }, { expectedVersion: 1, revision: revision(3) }),
        )
        return {
          listed: yield* repository.listRevisions(TEST_TENANT.id, encounter(1).id),
          hidden: yield* repository.listRevisions(OTHER_TENANT, encounter(1).id),
        }
      }),
    )
    expect(result.listed).toEqual([revision(1), revision(2)])
    expect(result.hidden).toEqual([])
  })
})

describe('EncounterRepository revisions (sqlite)', () => {
  it('refuses to change or delete a stored revision', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* EncounterRepository
        const sql = yield* SqlClient.SqlClient
        yield* repository.save(encounter(1), { expectedVersion: null, revision: revision(1) })
        return {
          update: yield* Effect.exit(sql`UPDATE encounter_revisions SET note_body = 'x'`),
          remove: yield* Effect.exit(sql`DELETE FROM encounter_revisions`),
          listed: yield* repository.listRevisions(TEST_TENANT.id, encounter(1).id),
        }
      }).pipe(Effect.provide(PersistenceSqlite(':memory:'))),
    )
    expect(Exit.isFailure(result.update)).toBe(true)
    expect(Exit.isFailure(result.remove)).toBe(true)
    expect(result.listed).toEqual([revision(1)])
  })

  it('moves encounters completed before 0010 into their first revision and retracts those of canceled visits', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hemr-'))
    const filename = join(dir, 'hemr.sqlite')
    const canceled = testVisit({
      status: 'CANCELED',
      statusReason: '이중 접수',
      statusChangedAt: '2026-11-01T02:00:00.000Z',
    })
    const upTo = (last: string) =>
      SqliteMigrator.layer({
        loader: SqliteMigrator.fromRecord(
          Object.fromEntries(Object.entries(migrations).filter(([key]) => key <= last)),
        ),
      }).pipe(Layer.provideMerge(SqliteClient.layer({ filename })))
    try {
      await Effect.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`
            INSERT INTO encounters (id, tenant_id, patient_id, visit_id, doctor_id, encounter_type, coverage, service_at,
              note_body, diagnoses, benefit_flags, status, created_at, updated_at, version, completed_at)
            VALUES
              ('enc_1', ${TEST_TENANT.id}, 'pat_1', NULL, 'usr_1', 'OFFICE', 'SELF_PAY', '2026-11-01T00:00:00.000Z',
               '<p>요통</p>', '[]', '{}', 'COMPLETED', '2026-11-01T00:00:00.000Z', '2026-11-01T01:00:00.000Z', 3,
               '2026-11-01T01:00:00.000Z'),
              ('enc_2', ${TEST_TENANT.id}, 'pat_1', NULL, NULL, 'OFFICE', 'SELF_PAY', '2026-11-01T00:00:00.000Z',
               '', '[]', '{}', 'DRAFT', '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z', 1, NULL),
              ('enc_3', ${TEST_TENANT.id}, 'pat_1', ${canceled.id}, NULL, 'OFFICE', 'SELF_PAY',
               '2026-11-01T00:00:00.000Z', '', '[]', '{}', 'DRAFT', '2026-11-01T00:00:00.000Z',
               '2026-11-01T00:00:00.000Z', 1, NULL)
          `
          yield* (yield* VisitRepository).save(canceled, { expectedVersion: null })
        }).pipe(
          Effect.provide(
            VisitRepository.layerSql.pipe(
              Layer.provideMerge(Outbox.layerSql),
              Layer.provideMerge(upTo('0009_encounter_completion')),
            ),
          ),
        ),
      )
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          return {
            encounters: yield* sql<{ id: string; revision: number; status: string; retraction: string | null }>`
              SELECT id, revision, status, retraction FROM encounters ORDER BY id
            `,
            revisions: yield* sql`SELECT encounter_id, revision, note_body, source, recorded_by, recorded_at
              FROM encounter_revisions`,
          }
        }).pipe(Effect.provide(upTo('9999'))),
      )
      expect(
        result.encounters.map(({ retraction, ...each }) => ({
          ...each,
          retraction: retraction && JSON.parse(retraction),
        })),
      ).toEqual([
        { id: 'enc_1', revision: 1, status: 'COMPLETED', retraction: null },
        { id: 'enc_2', revision: 0, status: 'DRAFT', retraction: null },
        {
          id: 'enc_3',
          revision: 0,
          status: 'ENTERED_IN_ERROR',
          retraction: { reason: '이중 접수', retractedAt: '2026-11-01T02:00:00.000Z', retractedBy: null },
        },
      ])
      expect(result.revisions).toEqual([
        {
          encounter_id: 'enc_1',
          revision: 1,
          note_body: '<p>요통</p>',
          source: 'COMPLETION',
          recorded_by: 'usr_1',
          recorded_at: '2026-11-01T01:00:00.000Z',
        },
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
