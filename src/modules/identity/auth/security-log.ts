import { Context, Effect, Layer, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { Id } from '../../../shared/ids/ids.types.ts'

export type SecurityEventType =
  'LOGIN_SUCCEEDED' | 'LOGIN_FAILED' | 'ACCOUNT_LOCKED' | 'REFRESH_TOKEN_REUSED' | 'LOGGED_OUT' | 'TENANT_SWITCHED'

/** 보안 감사 로그 한 건입니다. 비밀번호·토큰은 담지 않습니다. */
export interface SecurityEvent {
  type: SecurityEventType
  time: string
  /** 로그인 시도에 쓴 아이디(정규화)입니다. 없는 아이디도 남깁니다. */
  loginId: string | null
  userId: Id<'user'> | null
  tenantId: Id<'tenant'> | null
  sessionId: Id<'session'> | null
  /** 실패 사유 같은 보충 값입니다. 예: `PASSWORD_MISMATCH` */
  detail: string | null
}

/**
 * 보안 감사 로그입니다 (identity-access.md 감사). 업무 데이터 변경을 담는 도메인 이벤트와 달리, 요청이 실패해도
 * 남아야 하므로 업무 트랜잭션 밖에서 바로 씁니다.
 */
export class SecurityLog extends Context.Service<
  SecurityLog,
  {
    record(event: SecurityEvent): Effect.Effect<void>
    /** 기록 순서대로 읽습니다. 조회 API가 생기기 전까지 테스트에 씁니다. */
    list: Effect.Effect<ReadonlyArray<SecurityEvent>>
  }
>()('hemr/identity/SecurityLog') {
  static readonly layerMemory = Layer.effect(
    SecurityLog,
    Effect.gen(function* () {
      const events = yield* Ref.make<ReadonlyArray<SecurityEvent>>([])
      return SecurityLog.of({
        record: (event) => Ref.update(events, (all) => [...all, { ...event }]),
        list: Ref.get(events),
      })
    }),
  )

  /** SQL 테이블 `security_events`에 보관합니다. 마이그레이션 `0003`이 만듭니다. */
  static readonly layerSql = Layer.effect(
    SecurityLog,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      return SecurityLog.of({
        record: (event) =>
          sql`
            INSERT INTO security_events ${sql.insert({
              type: event.type,
              time: event.time,
              login_id: event.loginId,
              user_id: event.userId,
              tenant_id: event.tenantId,
              session_id: event.sessionId,
              detail: event.detail,
            })}
          `.pipe(Effect.asVoid, Effect.orDie),
        list: sql<SecurityEvent>`
          SELECT type, time, login_id AS loginId, user_id AS userId, tenant_id AS tenantId,
            session_id AS sessionId, detail
          FROM security_events ORDER BY seq
        `.pipe(Effect.orDie),
      })
    }),
  )
}
