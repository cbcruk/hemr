import { Context, Effect, Layer, Option, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import type { Visit } from './visit.ts'

/** 저장할 때 함께 넘기는 값입니다. */
export interface SaveVisitOptions {
  /**
   * 저장소에 있어야 하는 현재 버전입니다. 다르면 `VersionMismatch`로 아무것도 쓰지 않습니다. 새 내원이면 `null`이고,
   * 같은 ID가 이미 있으면 `VersionMismatch`입니다. 접수 엔드포인트는 이 경우를 412가 아니라 409로 바꿔야 합니다.
   * 수정할 내원이 없으면 `currentVersion`은 0입니다.
   */
  expectedVersion: number | null
  /** 같은 트랜잭션에서 outbox에 쓸 이벤트입니다. */
  events?: ReadonlyArray<DomainEvent>
}

/** 내원 목록 조건입니다. */
export interface VisitListQuery {
  date: string
  status?: Visit['status']
}

/** 환자의 이전 내원에서 본 값입니다. 취소한 내원은 세지 않습니다. 접수 검증(본인확인·초진)에 씁니다. */
export interface VisitHistory {
  firstVisitDate: string | null
  /** 본인확인을 한 마지막 내원의 진료일입니다. */
  lastIdentityVerifiedOn: string | null
}

/**
 * 내원 저장소입니다. 환경마다 다른 Layer를 넣어 구현을 바꿉니다.
 *
 * 내원은 병원(`tenantId`)에 속합니다. `findById`는 그 병원의 내원만 찾고, `save`는 다른 병원의 같은 ID를 덮어쓰지
 * 않고 거절하되, 그 버전은 감추고 `currentVersion` 0의 `VersionMismatch`로 답합니다. ID는 서버가 만드는 ULID라 실제로
 * 겹칠 일은 없고, 겹쳐도 다른 병원 내원의 버전이 드러나지 않게 하려는 것입니다.
 *
 * `save`는 버전 비교, 내원 쓰기, outbox 쓰기를 한 번에 합니다. 하나라도 실패하면 아무것도 남지 않습니다.
 */
export class VisitRepository extends Context.Service<
  VisitRepository,
  {
    findById(tenantId: Id<'tenant'>, id: Id<'visit'>): Effect.Effect<Option.Option<Visit>>
    /** 그 병원·진료일의 내원입니다. 접수 시각, ID 순서입니다. */
    list(tenantId: Id<'tenant'>, query: VisitListQuery): Effect.Effect<ReadonlyArray<Visit>>
    historyOf(tenantId: Id<'tenant'>, patientId: Id<'patient'>): Effect.Effect<VisitHistory>
    save(visit: Visit, options: SaveVisitOptions): Effect.Effect<void, VersionMismatch>
  }
>()('hemr/front-desk/VisitRepository') {
  /** `seed`로 시작해 프로세스 메모리에 내원을 보관합니다. 이벤트는 `Outbox`에 씁니다. */
  static readonly layerMemory = (seed: ReadonlyArray<Visit> = []) =>
    Layer.effect(
      VisitRepository,
      Effect.gen(function* () {
        const store = yield* Ref.make(new Map(seed.map((visit) => [visit.id, visit])))
        const outbox = yield* Outbox

        return VisitRepository.of({
          findById: (tenantId, id) =>
            Ref.get(store).pipe(
              Effect.map((visits) =>
                Option.filter(Option.fromNullishOr(visits.get(id)), (each) => each.tenantId === tenantId),
              ),
            ),
          list: (tenantId, query) =>
            Ref.get(store).pipe(
              Effect.map((visits) =>
                [...visits.values()]
                  .filter(
                    (each) =>
                      each.tenantId === tenantId &&
                      each.date === query.date &&
                      (query.status === undefined || each.status === query.status),
                  )
                  .sort((a, b) => compare(a.checkedInAt, b.checkedInAt) || compare(a.id, b.id)),
              ),
            ),
          historyOf: (tenantId, patientId) =>
            Ref.get(store).pipe(
              Effect.map((visits) => {
                const dates = [...visits.values()].filter(
                  (each) => each.tenantId === tenantId && each.patientId === patientId && each.status !== 'CANCELED',
                )
                const verified = dates.filter((each) => each.eligibility.identityVerified)
                return { firstVisitDate: earliest(dates), lastIdentityVerifiedOn: latest(verified) }
              }),
            ),
          save: (visit, options) =>
            Effect.gen(function* () {
              // 비교와 쓰기를 `Ref.modify` 한 번에 해, 동시에 저장해도 SQL 구현처럼 하나만 통과합니다
              const mismatch = yield* Ref.modify(store, (visits) => {
                const current = visits.get(visit.id)
                if (current !== undefined && current.tenantId !== visit.tenantId) return [0, visits]
                return (current?.version ?? null) === options.expectedVersion
                  ? [null, new Map(visits).set(visit.id, visit)]
                  : [current?.version ?? 0, visits]
              })
              if (mismatch !== null) return yield* new VersionMismatch({ currentVersion: mismatch })
              yield* outbox.append(options.events ?? [])
            }),
        })
      }),
    )

  /** SQL `visits` 테이블에 보관합니다. 내원과 이벤트를 한 트랜잭션에서 씁니다. */
  static readonly layerSql = Layer.effect(
    VisitRepository,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const outbox = yield* Outbox

      interface Row {
        id: string
        tenantId: string
        patientId: string
        date: string
        checkedInAt: string
        coverage: Visit['coverage']
        isFirstVisit: number
        eligibility: string
        benefitFlags: string
        encounterId: string | null
        status: Visit['status']
        statusChangedAt: string
        statusReason: string | null
        hasClinicalData: number
        version: number
      }

      const toVisit = (row: Row): Visit => ({
        id: row.id as Visit['id'],
        tenantId: row.tenantId as Visit['tenantId'],
        patientId: row.patientId as Visit['patientId'],
        date: row.date,
        checkedInAt: row.checkedInAt,
        coverage: row.coverage,
        isFirstVisit: row.isFirstVisit === 1,
        eligibility: JSON.parse(row.eligibility) as Visit['eligibility'],
        benefitFlags: JSON.parse(row.benefitFlags) as Visit['benefitFlags'],
        encounterId: row.encounterId as Visit['encounterId'],
        status: row.status,
        statusChangedAt: row.statusChangedAt,
        ...(row.statusReason === null ? {} : { statusReason: row.statusReason }),
        hasClinicalData: row.hasClinicalData === 1,
        version: row.version,
      })

      const currentVersion = (tenantId: string, id: string) =>
        sql<{ version: number }>`SELECT version FROM visits WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
          Effect.map((rows) => rows[0]?.version ?? 0),
        )

      const write = (visit: Visit, expectedVersion: number | null) => {
        const values = {
          patient_id: visit.patientId,
          date: visit.date,
          checked_in_at: visit.checkedInAt,
          coverage: visit.coverage,
          is_first_visit: visit.isFirstVisit ? 1 : 0,
          eligibility: JSON.stringify(visit.eligibility),
          benefit_flags: JSON.stringify(visit.benefitFlags),
          encounter_id: visit.encounterId,
          status: visit.status,
          status_changed_at: visit.statusChangedAt,
          status_reason: visit.statusReason ?? null,
          has_clinical_data: visit.hasClinicalData ? 1 : 0,
          version: visit.version,
        }
        // 버전 비교와 쓰기를 한 문장으로 해, 읽은 뒤 다른 요청이 먼저 저장해도 덮어쓰지 않습니다
        return expectedVersion === null
          ? sql<{ id: string }>`
              INSERT INTO visits ${sql.insert({ id: visit.id, tenant_id: visit.tenantId, ...values })}
              ON CONFLICT (id) DO NOTHING
              RETURNING id
            `
          : sql<{ id: string }>`
              UPDATE visits SET ${sql.update(values)}
              WHERE id = ${visit.id} AND tenant_id = ${visit.tenantId} AND version = ${expectedVersion}
              RETURNING id
            `
      }

      const columns = sql`
        id, tenant_id AS tenantId, patient_id AS patientId, date, checked_in_at AS checkedInAt, coverage,
        is_first_visit AS isFirstVisit, eligibility, benefit_flags AS benefitFlags, encounter_id AS encounterId, status,
        status_changed_at AS statusChangedAt, status_reason AS statusReason, has_clinical_data AS hasClinicalData, version
      `

      return VisitRepository.of({
        findById: (tenantId, id) =>
          sql<Row>`SELECT ${columns} FROM visits WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toVisit)),
            Effect.orDie,
          ),
        list: (tenantId, query) =>
          sql<Row>`
            SELECT ${columns} FROM visits
            WHERE tenant_id = ${tenantId} AND date = ${query.date}
              ${query.status === undefined ? sql`` : sql`AND status = ${query.status}`}
            ORDER BY checked_in_at, id
          `.pipe(
            Effect.map((rows) => rows.map(toVisit)),
            Effect.orDie,
          ),
        historyOf: (tenantId, patientId) =>
          sql<VisitHistory>`
            SELECT MIN(date) AS firstVisitDate,
              MAX(CASE WHEN json_extract(eligibility, '$.identityVerified') = 1 THEN date END) AS lastIdentityVerifiedOn
            FROM visits WHERE tenant_id = ${tenantId} AND patient_id = ${patientId} AND status != 'CANCELED'
          `.pipe(
            Effect.map((rows) => rows[0] ?? { firstVisitDate: null, lastIdentityVerifiedOn: null }),
            Effect.orDie,
          ),
        save: (visit, options) =>
          Effect.gen(function* () {
            const written = yield* write(visit, options.expectedVersion)
            if (written.length === 0) {
              return yield* new VersionMismatch({ currentVersion: yield* currentVersion(visit.tenantId, visit.id) })
            }
            yield* outbox.append(options.events ?? [])
          }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die)),
      })
    }),
  )
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const earliest = (visits: ReadonlyArray<Visit>) => visits.map((each) => each.date).sort(compare)[0] ?? null
const latest = (visits: ReadonlyArray<Visit>) =>
  visits
    .map((each) => each.date)
    .sort(compare)
    .at(-1) ?? null
