import { createHash } from 'node:crypto'
import { Context, Effect, Layer, Option, Ref, Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { SqlClient } from 'effect/sql'
import type { Id } from '../ids/ids.types.ts'
import { problemType } from '../problem/problem.ts'

/** 같은 키로 다시 온 요청에 처음 응답을 돌려주는 기간입니다 (conventions.md 멱등성). */
export const IDEMPOTENCY_WINDOW_MILLIS = 24 * 60 * 60 * 1000

/** `Idempotency-Key` 헤더입니다. 클라이언트가 만든 1–255자 문자열입니다. */
export const IdempotencyKey = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(255))

/** 같은 키를 다른 요청에 썼습니다. 처음 요청과 경로·본문이 다릅니다. */
export class IdempotencyKeyReused extends HttpApiError.Problem<IdempotencyKeyReused>()(
  'IdempotencyKeyReused',
  {
    type: problemType('IDEMPOTENCY_KEY_REUSED'),
    status: 422,
    title: 'Idempotency key was used for a different request',
  },
  { code: Schema.tag('IDEMPOTENCY_KEY_REUSED') },
) {}

/** 저장한 처음 응답입니다. */
export interface IdempotencyRecord {
  /** 요청(경로·본문)의 해시입니다. 같은 키의 다른 요청을 알아봅니다. */
  fingerprint: string
  /** 처음 성공 응답 본문(JSON)입니다. */
  response: string
  createdAt: string
}

/**
 * 멱등성 키 저장소입니다. 병원별로 키 하나에 처음 성공 응답 하나를 둡니다. 실패한 요청은 남기지 않아 같은 키로 다시
 * 보낼 수 있습니다.
 */
export class IdempotencyStore extends Context.Service<
  IdempotencyStore,
  {
    find(tenantId: Id<'tenant'>, key: string): Effect.Effect<Option.Option<IdempotencyRecord>>
    /** 키의 응답을 남깁니다. 기간이 지난 같은 키는 덮어씁니다. */
    save(tenantId: Id<'tenant'>, key: string, record: IdempotencyRecord): Effect.Effect<void>
  }
>()('hemr/shared/IdempotencyStore') {
  static readonly layerMemory = Layer.effect(
    IdempotencyStore,
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<string, IdempotencyRecord>())
      return IdempotencyStore.of({
        find: (tenantId, key) =>
          Ref.get(store).pipe(Effect.map((all) => Option.fromNullishOr(all.get(`${tenantId}:${key}`)))),
        save: (tenantId, key, record) => Ref.update(store, (all) => new Map(all).set(`${tenantId}:${key}`, record)),
      })
    }),
  )

  static readonly layerSql = Layer.effect(
    IdempotencyStore,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      return IdempotencyStore.of({
        find: (tenantId, key) =>
          sql<IdempotencyRecord>`
            SELECT fingerprint, response, created_at AS createdAt FROM idempotency_keys
            WHERE tenant_id = ${tenantId} AND key = ${key}
          `.pipe(
            Effect.map((rows) => Option.fromNullishOr(rows[0])),
            Effect.orDie,
          ),
        save: (tenantId, key, record) =>
          sql`
            INSERT INTO idempotency_keys ${sql.insert({
              tenant_id: tenantId,
              key,
              fingerprint: record.fingerprint,
              response: record.response,
              created_at: record.createdAt,
            })}
            ON CONFLICT (tenant_id, key) DO UPDATE SET
              fingerprint = excluded.fingerprint, response = excluded.response, created_at = excluded.created_at
          `.pipe(Effect.asVoid, Effect.orDie),
      })
    }),
  )
}

/** 요청의 해시입니다. 같은 키로 온 요청이 처음과 같은지 비교합니다. */
export function requestFingerprint(request: unknown): string {
  return createHash('sha256').update(JSON.stringify(request)).digest('hex')
}

/**
 * `effect`를 멱등하게 실행합니다. 같은 병원에서 같은 키로 24시간 안에 같은 요청이 다시 오면 `effect`를 실행하지 않고
 * 처음 응답을 `schema`로 읽어 돌려줍니다. 커맨드(`operation`)나 요청이 다르면 422 `IDEMPOTENCY_KEY_REUSED`입니다.
 *
 * 기간이 지난 키는 같은 키가 다시 올 때 덮어씁니다. 지난 키를 지우는 작업은 아직 없습니다.
 *
 * 응답은 `effect`가 성공한 뒤 남깁니다. 같은 트랜잭션 안에서 부르면 쓰기와 응답 기록이 함께 커밋·롤백됩니다.
 * SQLite는 트랜잭션을 하나씩 실행하므로 같은 키로 동시에 와도 뒤 요청은 앞 요청의 응답을 봅니다.
 */
export const idempotent = <A, I, E, R>(
  input: {
    tenantId: Id<'tenant'>
    key: string
    /** 커맨드 이름입니다. 같은 키를 다른 커맨드에 쓰면 본문이 같아도 다른 요청입니다. */
    operation: string
    request: unknown
    now: string
    schema: Schema.Codec<A, I>
  },
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | IdempotencyKeyReused, R | IdempotencyStore> =>
  Effect.gen(function* () {
    const store = yield* IdempotencyStore
    const fingerprint = requestFingerprint({ operation: input.operation, request: input.request })
    const found = Option.filter(
      yield* store.find(input.tenantId, input.key),
      (record) => Date.parse(input.now) - Date.parse(record.createdAt) < IDEMPOTENCY_WINDOW_MILLIS,
    )
    if (Option.isSome(found)) {
      if (found.value.fingerprint !== fingerprint) return yield* new IdempotencyKeyReused({})
      return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(input.schema))(found.value.response).pipe(
        Effect.orDie,
      )
    }
    const result = yield* effect
    const response = yield* Schema.encodeEffect(Schema.fromJsonString(input.schema))(result).pipe(Effect.orDie)
    yield* store.save(input.tenantId, input.key, { fingerprint, response, createdAt: input.now })
    return result
  })
