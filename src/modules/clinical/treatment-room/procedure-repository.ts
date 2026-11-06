import { Context, Effect, Layer, Option, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import type { Procedure } from './procedure.ts'

/** 한 번에 쓸 시술 하나입니다. `expectedVersion`은 저장소에 있어야 하는 버전이고, 새 시술이면 `null`입니다. */
export interface ProcedureWrite {
  procedure: Procedure
  expectedVersion: number | null
}

/**
 * 시술 저장소입니다. 내원 저장소와 같은 계약을 여러 시술에 넓혔습니다. `saveAll`은 모든 시술의 버전 비교, 쓰기,
 * outbox 쓰기를 한 번에 하고, 하나라도 어긋나면 아무것도 쓰지 않고 `VersionMismatch`입니다. 다른 병원의 같은 ID는
 * `currentVersion` 0으로 거절합니다.
 */
export class ProcedureRepository extends Context.Service<
  ProcedureRepository,
  {
    findById(tenantId: Id<'tenant'>, id: Id<'procedure'>): Effect.Effect<Option.Option<Procedure>>
    /** 그 내원들의 시술입니다. 내원 순서와 상관없이 내원별 `order` 순서입니다. */
    listByVisits(tenantId: Id<'tenant'>, visitIds: ReadonlyArray<Id<'visit'>>): Effect.Effect<ReadonlyArray<Procedure>>
    /** 모든 병원에서 `now`까지 타이머가 끝난 진행 중 시술입니다. 끝난 시각 순서입니다. 서버 타이머가 만료할 대상입니다. */
    listDue(now: string): Effect.Effect<ReadonlyArray<Procedure>>
    saveAll(
      writes: ReadonlyArray<ProcedureWrite>,
      events?: ReadonlyArray<DomainEvent>,
    ): Effect.Effect<void, VersionMismatch>
    /** 시술을 지웁니다. 버전이 다르면 `VersionMismatch`입니다. 대기 시술만 지우는 것은 호출하는 쪽이 확인합니다. */
    remove(procedure: Procedure, events?: ReadonlyArray<DomainEvent>): Effect.Effect<void, VersionMismatch>
  }
>()('hemr/clinical/ProcedureRepository') {
  /** 프로세스 메모리에 시술을 보관합니다. 이벤트는 `Outbox`에 씁니다. */
  static readonly layerMemory = Layer.effect(
    ProcedureRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<string, Procedure>())
      const outbox = yield* Outbox

      const versionOf = (all: Map<string, Procedure>, procedure: Procedure) => {
        const current = all.get(procedure.id)
        if (current !== undefined && current.tenantId !== procedure.tenantId) return 0
        return current?.version ?? null
      }

      return ProcedureRepository.of({
        findById: (tenantId, id) =>
          Ref.get(store).pipe(
            Effect.map((all) => Option.filter(Option.fromNullishOr(all.get(id)), (each) => each.tenantId === tenantId)),
          ),
        listByVisits: (tenantId, visitIds) =>
          Ref.get(store).pipe(
            Effect.map((all) => {
              const visits = new Set<string>(visitIds)
              return [...all.values()]
                .filter((each) => each.tenantId === tenantId && visits.has(each.visitId))
                .sort((a, b) => compare(a.visitId, b.visitId) || a.order - b.order || compare(a.id, b.id))
            }),
          ),
        listDue: (now) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              [...all.values()]
                .filter((each) => each.status === 'RUNNING' && each.timerEndsAt !== null && each.timerEndsAt <= now)
                .sort((a, b) => compare(a.timerEndsAt ?? '', b.timerEndsAt ?? '') || compare(a.id, b.id)),
            ),
          ),
        saveAll: (writes, events = []) =>
          Effect.gen(function* () {
            // 비교와 쓰기를 `Ref.modify` 한 번에 해, 동시에 저장해도 SQL 구현처럼 하나만 통과합니다
            const mismatch = yield* Ref.modify(store, (all) => {
              for (const write of writes) {
                const version = versionOf(all, write.procedure)
                if (version !== write.expectedVersion) return [version ?? 0, all]
              }
              const next = new Map(all)
              for (const write of writes) next.set(write.procedure.id, write.procedure)
              return [null, next]
            })
            if (mismatch !== null) return yield* new VersionMismatch({ currentVersion: mismatch })
            yield* outbox.append(events)
          }),
        remove: (procedure, events = []) =>
          Effect.gen(function* () {
            const mismatch = yield* Ref.modify(store, (all) => {
              const version = versionOf(all, procedure)
              if (version !== procedure.version) return [version ?? 0, all]
              const next = new Map(all)
              next.delete(procedure.id)
              return [null, next]
            })
            if (mismatch !== null) return yield* new VersionMismatch({ currentVersion: mismatch })
            yield* outbox.append(events)
          }),
      })
    }),
  )

  /** SQL `procedures` 테이블에 보관합니다. 시술과 이벤트를 한 트랜잭션에서 씁니다. */
  static readonly layerSql = Layer.effect(
    ProcedureRepository,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const outbox = yield* Outbox

      interface Row {
        id: string
        tenantId: string
        visitId: string
        patientId: string
        name: string
        sourcePrescriptionLineId: string | null
        order: number
        assignee: Procedure['assignee']
        durationSeconds: number
        status: Procedure['status']
        startedAt: string | null
        timerEndsAt: string | null
        completedAt: string | null
        createdAt: string
        updatedAt: string
        version: number
      }

      const toProcedure = (row: Row): Procedure => ({
        ...row,
        id: row.id as Procedure['id'],
        tenantId: row.tenantId as Procedure['tenantId'],
        visitId: row.visitId as Procedure['visitId'],
        patientId: row.patientId as Procedure['patientId'],
        sourcePrescriptionLineId: row.sourcePrescriptionLineId as Procedure['sourcePrescriptionLineId'],
      })

      const columns = sql`
        id, tenant_id AS tenantId, visit_id AS visitId, patient_id AS patientId, name,
        source_prescription_line_id AS sourcePrescriptionLineId, sort_order AS "order", assignee,
        duration_seconds AS durationSeconds, status, started_at AS startedAt, timer_ends_at AS timerEndsAt,
        completed_at AS completedAt, created_at AS createdAt, updated_at AS updatedAt, version
      `

      const currentVersion = (tenantId: string, id: string) =>
        sql<{ version: number }>`SELECT version FROM procedures WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
          Effect.map((rows) => rows[0]?.version ?? 0),
        )

      const write = ({ procedure, expectedVersion }: ProcedureWrite) => {
        const values = {
          name: procedure.name,
          sort_order: procedure.order,
          assignee: procedure.assignee,
          duration_seconds: procedure.durationSeconds,
          status: procedure.status,
          started_at: procedure.startedAt,
          timer_ends_at: procedure.timerEndsAt,
          completed_at: procedure.completedAt,
          updated_at: procedure.updatedAt,
          version: procedure.version,
        }
        // 버전 비교와 쓰기를 한 문장으로 해, 읽은 뒤 다른 요청이 먼저 저장해도 덮어쓰지 않습니다
        return expectedVersion === null
          ? sql<{ id: string }>`
              INSERT INTO procedures ${sql.insert({
                id: procedure.id,
                tenant_id: procedure.tenantId,
                visit_id: procedure.visitId,
                patient_id: procedure.patientId,
                source_prescription_line_id: procedure.sourcePrescriptionLineId,
                created_at: procedure.createdAt,
                ...values,
              })}
              ON CONFLICT (id) DO NOTHING
              RETURNING id
            `
          : sql<{ id: string }>`
              UPDATE procedures SET ${sql.update(values)}
              WHERE id = ${procedure.id} AND tenant_id = ${procedure.tenantId} AND version = ${expectedVersion}
              RETURNING id
            `
      }

      return ProcedureRepository.of({
        findById: (tenantId, id) =>
          sql<Row>`SELECT ${columns} FROM procedures WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toProcedure)),
            Effect.orDie,
          ),
        listByVisits: (tenantId, visitIds) =>
          visitIds.length === 0
            ? Effect.succeed([])
            : sql<Row>`
                SELECT ${columns} FROM procedures
                WHERE tenant_id = ${tenantId} AND ${sql.in('visit_id', visitIds)}
                ORDER BY visit_id, sort_order, id
              `.pipe(
                Effect.map((rows) => rows.map(toProcedure)),
                Effect.orDie,
              ),
        listDue: (now) =>
          sql<Row>`
            SELECT ${columns} FROM procedures
            WHERE status = 'RUNNING' AND timer_ends_at <= ${now}
            ORDER BY timer_ends_at, id
          `.pipe(
            Effect.map((rows) => rows.map(toProcedure)),
            Effect.orDie,
          ),
        saveAll: (writes, events = []) =>
          Effect.gen(function* () {
            for (const each of writes) {
              const written = yield* write(each)
              if (written.length === 0) {
                // 트랜잭션이 앞서 쓴 시술도 되돌립니다
                return yield* new VersionMismatch({
                  currentVersion: yield* currentVersion(each.procedure.tenantId, each.procedure.id),
                })
              }
            }
            yield* outbox.append(events)
          }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die)),
        remove: (procedure, events = []) =>
          Effect.gen(function* () {
            const removed = yield* sql<{ id: string }>`
              DELETE FROM procedures
              WHERE id = ${procedure.id} AND tenant_id = ${procedure.tenantId} AND version = ${procedure.version}
              RETURNING id
            `
            if (removed.length === 0) {
              return yield* new VersionMismatch({
                currentVersion: yield* currentVersion(procedure.tenantId, procedure.id),
              })
            }
            yield* outbox.append(events)
          }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die)),
      })
    }),
  )
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
