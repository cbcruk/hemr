import { Context, Effect, Layer, Option, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import type { Encounter } from './encounter.ts'

/** 저장할 때 함께 넘기는 값입니다. 내원 저장소(`SaveVisitOptions`)와 같습니다. */
export interface SaveEncounterOptions {
  /** 저장소에 있어야 하는 현재 버전입니다. 새 진료면 `null`입니다. 수정할 진료가 없으면 `currentVersion`은 0입니다. */
  expectedVersion: number | null
  /** 같은 트랜잭션에서 outbox에 쓸 이벤트입니다. */
  events?: ReadonlyArray<DomainEvent>
}

/**
 * 진료 저장소입니다. 내원 저장소와 같은 계약입니다. 진료는 병원(`tenantId`)에 속하고, 다른 병원의 같은 ID는 덮어쓰지
 * 않고 `currentVersion` 0의 `VersionMismatch`로 거절합니다. `save`는 버전 비교, 진료 쓰기, outbox 쓰기를 한 번에 합니다.
 */
export class EncounterRepository extends Context.Service<
  EncounterRepository,
  {
    findById(tenantId: Id<'tenant'>, id: Id<'encounter'>): Effect.Effect<Option.Option<Encounter>>
    /** 그 병원·환자의 진료입니다. 최근 진료가 먼저입니다(`serviceAt`, ID 내림차순). */
    listByPatient(tenantId: Id<'tenant'>, patientId: Id<'patient'>): Effect.Effect<ReadonlyArray<Encounter>>
    save(encounter: Encounter, options: SaveEncounterOptions): Effect.Effect<void, VersionMismatch>
  }
>()('hemr/clinical/EncounterRepository') {
  /** 프로세스 메모리에 진료를 보관합니다. 이벤트는 `Outbox`에 씁니다. */
  static readonly layerMemory = Layer.effect(
    EncounterRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<string, Encounter>())
      const outbox = yield* Outbox

      return EncounterRepository.of({
        findById: (tenantId, id) =>
          Ref.get(store).pipe(
            Effect.map((all) => Option.filter(Option.fromNullishOr(all.get(id)), (each) => each.tenantId === tenantId)),
          ),
        listByPatient: (tenantId, patientId) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              [...all.values()]
                .filter((each) => each.tenantId === tenantId && each.patientId === patientId)
                .sort((a, b) => compare(b.serviceAt, a.serviceAt) || compare(b.id, a.id)),
            ),
          ),
        save: (encounter, options) =>
          Effect.gen(function* () {
            // 비교와 쓰기를 `Ref.modify` 한 번에 해, 동시에 저장해도 SQL 구현처럼 하나만 통과합니다
            const mismatch = yield* Ref.modify(store, (all) => {
              const current = all.get(encounter.id)
              if (current !== undefined && current.tenantId !== encounter.tenantId) return [0, all]
              return (current?.version ?? null) === options.expectedVersion
                ? [null, new Map(all).set(encounter.id, encounter)]
                : [current?.version ?? 0, all]
            })
            if (mismatch !== null) return yield* new VersionMismatch({ currentVersion: mismatch })
            yield* outbox.append(options.events ?? [])
          }),
      })
    }),
  )

  /** SQL `encounters` 테이블에 보관합니다. 진료와 이벤트를 한 트랜잭션에서 씁니다. */
  static readonly layerSql = Layer.effect(
    EncounterRepository,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const outbox = yield* Outbox

      interface Row {
        id: string
        tenantId: string
        patientId: string
        visitId: string | null
        doctorId: string | null
        encounterType: Encounter['encounterType']
        coverage: Encounter['coverage']
        serviceAt: string
        noteBody: string
        diagnoses: string
        prescriptionLines: string
        benefitFlags: string
        status: Encounter['status']
        createdAt: string
        updatedAt: string
        version: number
      }

      const toEncounter = (row: Row): Encounter => ({
        id: row.id as Encounter['id'],
        tenantId: row.tenantId as Encounter['tenantId'],
        patientId: row.patientId as Encounter['patientId'],
        visitId: row.visitId as Encounter['visitId'],
        doctorId: row.doctorId as Encounter['doctorId'],
        encounterType: row.encounterType,
        coverage: row.coverage,
        serviceAt: row.serviceAt,
        note: { body: row.noteBody },
        diagnoses: JSON.parse(row.diagnoses) as Encounter['diagnoses'],
        prescriptionLines: JSON.parse(row.prescriptionLines) as Encounter['prescriptionLines'],
        benefitFlags: JSON.parse(row.benefitFlags) as Encounter['benefitFlags'],
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        version: row.version,
      })

      const columns = sql`
        id, tenant_id AS tenantId, patient_id AS patientId, visit_id AS visitId, doctor_id AS doctorId,
        encounter_type AS encounterType, coverage, service_at AS serviceAt, note_body AS noteBody, diagnoses,
        prescription_lines AS prescriptionLines, benefit_flags AS benefitFlags, status, created_at AS createdAt, updated_at AS updatedAt, version
      `

      const currentVersion = (tenantId: string, id: string) =>
        sql<{ version: number }>`SELECT version FROM encounters WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
          Effect.map((rows) => rows[0]?.version ?? 0),
        )

      const write = (encounter: Encounter, expectedVersion: number | null) => {
        const values = {
          doctor_id: encounter.doctorId,
          coverage: encounter.coverage,
          note_body: encounter.note.body,
          diagnoses: JSON.stringify(encounter.diagnoses),
          prescription_lines: JSON.stringify(encounter.prescriptionLines),
          benefit_flags: JSON.stringify(encounter.benefitFlags),
          status: encounter.status,
          updated_at: encounter.updatedAt,
          version: encounter.version,
        }
        // 버전 비교와 쓰기를 한 문장으로 해, 읽은 뒤 다른 요청이 먼저 저장해도 덮어쓰지 않습니다
        return expectedVersion === null
          ? sql<{ id: string }>`
              INSERT INTO encounters ${sql.insert({
                id: encounter.id,
                tenant_id: encounter.tenantId,
                patient_id: encounter.patientId,
                visit_id: encounter.visitId,
                encounter_type: encounter.encounterType,
                service_at: encounter.serviceAt,
                created_at: encounter.createdAt,
                ...values,
              })}
              ON CONFLICT (id) DO NOTHING
              RETURNING id
            `
          : sql<{ id: string }>`
              UPDATE encounters SET ${sql.update(values)}
              WHERE id = ${encounter.id} AND tenant_id = ${encounter.tenantId} AND version = ${expectedVersion}
              RETURNING id
            `
      }

      return EncounterRepository.of({
        findById: (tenantId, id) =>
          sql<Row>`SELECT ${columns} FROM encounters WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toEncounter)),
            Effect.orDie,
          ),
        listByPatient: (tenantId, patientId) =>
          sql<Row>`
            SELECT ${columns} FROM encounters
            WHERE tenant_id = ${tenantId} AND patient_id = ${patientId}
            ORDER BY service_at DESC, id DESC
          `.pipe(
            Effect.map((rows) => rows.map(toEncounter)),
            Effect.orDie,
          ),
        save: (encounter, options) =>
          Effect.gen(function* () {
            const written = yield* write(encounter, options.expectedVersion)
            if (written.length === 0) {
              return yield* new VersionMismatch({
                currentVersion: yield* currentVersion(encounter.tenantId, encounter.id),
              })
            }
            yield* outbox.append(options.events ?? [])
          }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die)),
      })
    }),
  )
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
