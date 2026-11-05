import { Context, Effect, Layer, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { Id } from '../ids/ids.types.ts'
import type { DomainEvent, RecordedEvent } from './domain-event.ts'

/** 릴레이가 아직 내보내지 않은 outbox 행입니다. */
export interface PendingEvent {
  event: RecordedEvent
  /** 지금까지 내보내기에 실패한 횟수입니다. */
  attempts: number
  /** 이 시각 전에는 다시 시도하지 않습니다. 첫 시도 전이면 `null`입니다. */
  nextAttemptAt: string | null
}

/**
 * 이벤트 outbox입니다 (`docs/design/events.md`). 모듈은 상태 변경과 같은 트랜잭션에서 `append`하고, 릴레이가
 * `pending`으로 읽어 버스에 낸 뒤 결과를 기록합니다. 기록 순서(`seq`)대로 내보냅니다.
 */
export class Outbox extends Context.Service<
  Outbox,
  {
    /** 이벤트를 기록합니다. SQL 구현은 호출한 쪽의 트랜잭션에 함께 들어갑니다. */
    append(events: ReadonlyArray<DomainEvent>): Effect.Effect<void>
    /** 아직 내보내지 않은 행을 `seq` 순서로 `limit`개까지 읽습니다. */
    pending(limit: number): Effect.Effect<ReadonlyArray<PendingEvent>>
    markPublished(seq: number, publishedAt: string): Effect.Effect<void>
    markFailed(seq: number, failure: { error: string; nextAttemptAt: string }): Effect.Effect<void>
  }
>()('hemr/shared/Outbox') {
  /** 프로세스 메모리에 보관합니다. 테스트와 저장소 없는 실행에 씁니다. */
  static readonly layerMemory = Layer.effect(
    Outbox,
    Effect.gen(function* () {
      interface Row extends PendingEvent {
        publishedAt: string | null
        lastError: string | null
      }
      const rows = yield* Ref.make<ReadonlyArray<Row>>([])
      const update = (seq: number, patch: (row: Row) => Row) =>
        Ref.update(rows, (all) => all.map((row) => (row.event.seq === seq ? patch(row) : row)))

      return Outbox.of({
        append: (events) =>
          Ref.update(rows, (all) => [
            ...all,
            ...events.map((event, index) => ({
              event: { ...event, seq: all.length + index + 1 },
              attempts: 0,
              nextAttemptAt: null,
              publishedAt: null,
              lastError: null,
            })),
          ]),
        pending: (limit) =>
          Ref.get(rows).pipe(
            Effect.map((all) =>
              all
                .filter((row) => row.publishedAt === null)
                .slice(0, limit)
                .map(({ event, attempts, nextAttemptAt }) => ({ event, attempts, nextAttemptAt })),
            ),
          ),
        markPublished: (seq, publishedAt) => update(seq, (row) => ({ ...row, publishedAt })),
        markFailed: (seq, failure) =>
          update(seq, (row) => ({
            ...row,
            attempts: row.attempts + 1,
            nextAttemptAt: failure.nextAttemptAt,
            lastError: failure.error,
          })),
      })
    }),
  )

  /** SQL `outbox` 테이블에 보관합니다. 테이블은 마이그레이션 `0001`이 만듭니다. */
  static readonly layerSql = Layer.effect(
    Outbox,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      interface Row {
        seq: number
        id: string
        type: string
        time: string
        subject: string
        tenantId: string | null
        actor: string | null
        data: string
        attempts: number
        nextAttemptAt: string | null
      }

      const toPending = (row: Row): PendingEvent => ({
        event: {
          seq: row.seq,
          id: row.id as Id<'event'>,
          type: row.type,
          time: row.time,
          subject: row.subject,
          ...(row.tenantId === null ? {} : { tenantId: row.tenantId }),
          ...(row.actor === null ? {} : { actor: JSON.parse(row.actor) }),
          data: JSON.parse(row.data),
        },
        attempts: row.attempts,
        nextAttemptAt: row.nextAttemptAt,
      })

      return Outbox.of({
        append: (events) =>
          Effect.forEach(
            events,
            (event) => sql`
              INSERT INTO outbox (id, type, time, subject, tenant_id, actor, data)
              VALUES (${event.id}, ${event.type}, ${event.time}, ${event.subject}, ${event.tenantId ?? null},
                ${event.actor === undefined ? null : JSON.stringify(event.actor)}, ${JSON.stringify(event.data)})
            `,
            { discard: true },
          ).pipe(Effect.orDie),
        pending: (limit) =>
          sql<Row>`
            SELECT seq, id, type, time, subject, tenant_id AS tenantId, actor, data, attempts,
              next_attempt_at AS nextAttemptAt
            FROM outbox
            WHERE published_at IS NULL
            ORDER BY seq
            LIMIT ${limit}
          `.pipe(
            Effect.map((rows) => rows.map(toPending)),
            Effect.orDie,
          ),
        markPublished: (seq, publishedAt) =>
          sql`UPDATE outbox SET published_at = ${publishedAt} WHERE seq = ${seq}`.pipe(Effect.asVoid, Effect.orDie),
        markFailed: (seq, failure) =>
          sql`
            UPDATE outbox
            SET attempts = attempts + 1, next_attempt_at = ${failure.nextAttemptAt}, last_error = ${failure.error}
            WHERE seq = ${seq}
          `.pipe(Effect.asVoid, Effect.orDie),
      })
    }),
  )
}
