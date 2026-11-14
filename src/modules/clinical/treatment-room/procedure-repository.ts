import { Context, Effect, Layer, Option, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import type { Procedure } from './procedure.ts'
import type { TreatmentSession } from './treatment-session.aggregate.ts'

/**
 * 치료 세션 하나의 쓰기입니다. `expectedVersion`은 읽은 세션 버전이고 세션이 아직 없으면 0입니다. `procedures`는 새로
 * 쓰거나 바꾼 시술, `removed`는 지울 시술입니다.
 */
export interface TreatmentSessionWrite {
  tenantId: Id<'tenant'>
  visitId: Id<'visit'>
  expectedVersion: number
  at: string
  procedures: ReadonlyArray<Procedure>
  removed: ReadonlyArray<Id<'procedure'>>
}

/**
 * 시술 저장소입니다. 동시성은 내원 하나의 치료 세션(결정 M4) 단위입니다. `saveSession`은 세션 버전 비교·올리기,
 * 시술 쓰기·지우기, outbox 쓰기를 한 번에 하고, 세션 버전이 어긋나면 아무것도 쓰지 않고 `VersionMismatch`입니다.
 * 시술의 `version`은 그 시술이 바뀐 횟수로만 남고 비교하지 않습니다.
 */
export class ProcedureRepository extends Context.Service<
  ProcedureRepository,
  {
    findById(tenantId: Id<'tenant'>, id: Id<'procedure'>): Effect.Effect<Option.Option<Procedure>>
    /** 내원의 치료 세션입니다. 아직 쓴 적이 없으면 버전 0에 시술이 없습니다. */
    findSession(tenantId: Id<'tenant'>, visitId: Id<'visit'>): Effect.Effect<TreatmentSession>
    /** 그 내원들의 시술입니다. 내원 순서와 상관없이 내원별 `order` 순서입니다. */
    listByVisits(tenantId: Id<'tenant'>, visitIds: ReadonlyArray<Id<'visit'>>): Effect.Effect<ReadonlyArray<Procedure>>
    /** 모든 병원에서 `now`까지 타이머가 끝난 진행 중 시술입니다. 끝난 시각 순서입니다. 서버 타이머가 만료할 대상입니다. */
    listDue(now: string): Effect.Effect<ReadonlyArray<Procedure>>
    saveSession(write: TreatmentSessionWrite, events?: ReadonlyArray<DomainEvent>): Effect.Effect<void, VersionMismatch>
  }
>()('hemr/clinical/ProcedureRepository') {
  /** 프로세스 메모리에 시술을 보관합니다. 이벤트는 `Outbox`에 씁니다. */
  static readonly layerMemory = Layer.effect(
    ProcedureRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<string, Procedure>())
      const sessions = yield* Ref.make(new Map<string, number>())
      const outbox = yield* Outbox

      const sessionKey = (tenantId: string, visitId: string) => `${tenantId}/${visitId}`

      const listByVisits = (tenantId: Id<'tenant'>, visitIds: ReadonlyArray<Id<'visit'>>) =>
        Ref.get(store).pipe(
          Effect.map((all) => {
            const visits = new Set<string>(visitIds)
            return [...all.values()]
              .filter((each) => each.tenantId === tenantId && visits.has(each.visitId))
              .sort((a, b) => compare(a.visitId, b.visitId) || a.order - b.order || compare(a.id, b.id))
          }),
        )

      return ProcedureRepository.of({
        findById: (tenantId, id) =>
          Ref.get(store).pipe(
            Effect.map((all) => Option.filter(Option.fromNullishOr(all.get(id)), (each) => each.tenantId === tenantId)),
          ),
        findSession: (tenantId, visitId) =>
          Effect.gen(function* () {
            const version = (yield* Ref.get(sessions)).get(sessionKey(tenantId, visitId)) ?? 0
            return { tenantId, visitId, version, procedures: yield* listByVisits(tenantId, [visitId]) }
          }),
        listByVisits,
        listDue: (now) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              [...all.values()]
                .filter((each) => each.status === 'RUNNING' && each.timerEndsAt !== null && each.timerEndsAt <= now)
                .sort((a, b) => compare(a.timerEndsAt ?? '', b.timerEndsAt ?? '') || compare(a.id, b.id)),
            ),
          ),
        saveSession: (write, events = []) =>
          Effect.gen(function* () {
            const key = sessionKey(write.tenantId, write.visitId)
            // 세션 버전 비교·올리기를 `Ref.modify` 한 번에 해, 동시에 저장해도 SQL 구현처럼 하나만 통과합니다
            const mismatch = yield* Ref.modify(sessions, (all) => {
              const version = all.get(key) ?? 0
              if (version !== write.expectedVersion) return [version, all]
              return [null, new Map(all).set(key, version + 1)]
            })
            if (mismatch !== null) return yield* new VersionMismatch({ currentVersion: mismatch })
            const all = yield* Ref.get(store)
            for (const procedure of write.procedures) {
              const current = all.get(procedure.id)
              // SQL 구현처럼 다른 세션의 같은 ID는 덮어쓰지 않습니다. ID는 서버가 만들어 겹치면 결함입니다
              if (current !== undefined && sessionKey(current.tenantId, current.visitId) !== key) {
                return yield* Effect.die(new Error(`procedure ${procedure.id} belongs to another session`))
              }
            }
            yield* Ref.update(store, (all) => {
              const next = new Map(all)
              for (const procedure of write.procedures) next.set(procedure.id, procedure)
              for (const id of write.removed) {
                if (sessionKey(next.get(id)?.tenantId ?? '', next.get(id)?.visitId ?? '') === key) next.delete(id)
              }
              return next
            })
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

      const sessionVersion = (tenantId: string, visitId: string) =>
        sql<{ version: number }>`
          SELECT version FROM treatment_sessions WHERE tenant_id = ${tenantId} AND visit_id = ${visitId}
        `.pipe(Effect.map((rows) => rows[0]?.version ?? 0))

      /** 세션 버전 비교와 올리기를 한 문장으로 해, 읽은 뒤 다른 요청이 먼저 저장해도 덮어쓰지 않습니다. */
      const advanceSession = (write: TreatmentSessionWrite) =>
        write.expectedVersion === 0
          ? sql<{ version: number }>`
              INSERT INTO treatment_sessions ${sql.insert({
                tenant_id: write.tenantId,
                visit_id: write.visitId,
                version: 1,
                updated_at: write.at,
              })}
              ON CONFLICT (tenant_id, visit_id) DO NOTHING
              RETURNING version
            `
          : sql<{ version: number }>`
              UPDATE treatment_sessions SET version = version + 1, updated_at = ${write.at}
              WHERE tenant_id = ${write.tenantId} AND visit_id = ${write.visitId} AND version = ${write.expectedVersion}
              RETURNING version
            `

      const upsert = (procedure: Procedure) => {
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
        // 다른 병원의 같은 ID는 덮어쓰지 않습니다. ID는 서버가 만들어 겹치면 결함입니다
        return sql<{ id: string }>`
          INSERT INTO procedures ${sql.insert({
            id: procedure.id,
            tenant_id: procedure.tenantId,
            visit_id: procedure.visitId,
            patient_id: procedure.patientId,
            source_prescription_line_id: procedure.sourcePrescriptionLineId,
            created_at: procedure.createdAt,
            ...values,
          })}
          ON CONFLICT (id) DO UPDATE SET ${sql.update(values)}
          WHERE procedures.tenant_id = excluded.tenant_id AND procedures.visit_id = excluded.visit_id
          RETURNING id
        `.pipe(
          Effect.flatMap((rows) =>
            rows.length === 0
              ? Effect.die(new Error(`procedure ${procedure.id} belongs to another session`))
              : Effect.void,
          ),
        )
      }

      const listByVisits = (tenantId: Id<'tenant'>, visitIds: ReadonlyArray<Id<'visit'>>) =>
        visitIds.length === 0
          ? Effect.succeed([])
          : sql<Row>`
              SELECT ${columns} FROM procedures
              WHERE tenant_id = ${tenantId} AND ${sql.in('visit_id', visitIds)}
              ORDER BY visit_id, sort_order, id
            `.pipe(
              Effect.map((rows) => rows.map(toProcedure)),
              Effect.orDie,
            )

      return ProcedureRepository.of({
        findById: (tenantId, id) =>
          sql<Row>`SELECT ${columns} FROM procedures WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toProcedure)),
            Effect.orDie,
          ),
        findSession: (tenantId, visitId) =>
          Effect.gen(function* () {
            const version = yield* sessionVersion(tenantId, visitId).pipe(Effect.orDie)
            return { tenantId, visitId, version, procedures: yield* listByVisits(tenantId, [visitId]) }
          }),
        listByVisits,
        listDue: (now) =>
          sql<Row>`
            SELECT ${columns} FROM procedures
            WHERE status = 'RUNNING' AND timer_ends_at <= ${now}
            ORDER BY timer_ends_at, id
          `.pipe(
            Effect.map((rows) => rows.map(toProcedure)),
            Effect.orDie,
          ),
        saveSession: (write, events = []) =>
          Effect.gen(function* () {
            const advanced = yield* advanceSession(write)
            if (advanced.length === 0) {
              return yield* new VersionMismatch({
                currentVersion: yield* sessionVersion(write.tenantId, write.visitId),
              })
            }
            for (const procedure of write.procedures) yield* upsert(procedure)
            if (write.removed.length > 0) {
              yield* sql`
                DELETE FROM procedures
                WHERE tenant_id = ${write.tenantId} AND visit_id = ${write.visitId} AND ${sql.in('id', write.removed)}
              `
            }
            yield* outbox.append(events)
          }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die)),
      })
    }),
  )
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
