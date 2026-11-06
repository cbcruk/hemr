import { Context, Effect, Layer, Ref } from 'effect'
import { SqlClient } from 'effect/sql'

/**
 * 개인정보 열람 기록 하나입니다 (conventions.md 감사와 열람 기록). 예: 주민등록번호 원문 조회
 * `{ action: 'READ_RRN', resource: 'patient', resourceId: 'pat_...', reason: '보험 자격 조회' }`
 */
export interface AccessLogEntry {
  time: string
  tenantId: string
  userId: string
  action: string
  resource: string
  resourceId: string
  /** `X-Access-Reason`로 받은 사유입니다. 사유가 필요 없는 열람이면 `null`입니다. */
  reason: string | null
}

/**
 * 개인정보 열람 기록입니다. 업무 트랜잭션과 따로 씁니다. 열람은 데이터를 바꾸지 않아 함께 되돌릴 것이 없고, 응답을 주기
 * 전에 써서 기록 없이 원문이 나가지 않게 합니다.
 */
export class AccessLog extends Context.Service<
  AccessLog,
  {
    record(entry: AccessLogEntry): Effect.Effect<void>
    /** 병원의 기록을 쓴 순서대로 줍니다. 조회 API가 생기기 전까지 테스트에서 씁니다. */
    list(tenantId: string): Effect.Effect<ReadonlyArray<AccessLogEntry>>
  }
>()('hemr/shared/AccessLog') {
  static readonly layerMemory = Layer.effect(
    AccessLog,
    Effect.gen(function* () {
      const entries = yield* Ref.make<ReadonlyArray<AccessLogEntry>>([])
      return AccessLog.of({
        record: (entry) => Ref.update(entries, (all) => [...all, { ...entry }]),
        list: (tenantId) =>
          Ref.get(entries).pipe(Effect.map((all) => all.filter((each) => each.tenantId === tenantId))),
      })
    }),
  )

  /** SQL 테이블 `access_logs`에 보관합니다. 마이그레이션 `0005`가 만듭니다. */
  static readonly layerSql = Layer.effect(
    AccessLog,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      return AccessLog.of({
        record: (entry) =>
          sql`
            INSERT INTO access_logs ${sql.insert({
              time: entry.time,
              tenant_id: entry.tenantId,
              user_id: entry.userId,
              action: entry.action,
              resource: entry.resource,
              resource_id: entry.resourceId,
              reason: entry.reason,
            })}
          `.pipe(Effect.asVoid, Effect.orDie),
        list: (tenantId) =>
          sql<AccessLogEntry>`
            SELECT time, tenant_id AS tenantId, user_id AS userId, action, resource, resource_id AS resourceId, reason
            FROM access_logs WHERE tenant_id = ${tenantId} ORDER BY seq
          `.pipe(Effect.orDie),
      })
    }),
  )
}
