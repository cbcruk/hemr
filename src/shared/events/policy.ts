import { Context, DateTime, Duration, Effect, Exit, Layer, Ref, Schedule } from 'effect'
import { SqlClient } from 'effect/sql'
import { Transaction } from '../db/transaction.ts'
import type { RecordedEvent } from './domain-event.ts'
import { Outbox } from './outbox.ts'

/**
 * 정책입니다 (`docs/design/events.md` 정책과 사가). 다른 애그리거트·모듈의 이벤트를 받아 할지 말지 정하고 자기 쪽
 * 커맨드를 보냅니다. 이미 일어난 일을 거부하지 않고, 이력을 다시 재생하지 않습니다.
 *
 * `handle`은 모든 이벤트를 받습니다. 관심 없는 이벤트는 아무것도 하지 않고 성공합니다. 실패(`E`)는 받는 쪽 커맨드의
 * 거부(이미 취소된 내원 등)이고, 실행기가 기록만 하고 다음 이벤트로 넘어갑니다. 보낸 쪽 커맨드는 되돌리지 않습니다
 * (domain-model.md 일관성 규칙 3). 결함은 그 이벤트에서 멈추고 다음 회차에 다시 시도합니다.
 */
export interface Policy<E extends { readonly _tag: string }, R> {
  /** 커서의 키입니다. 바꾸면 처음부터 다시 처리하므로 한 번 정하면 바꾸지 않습니다. */
  readonly name: string
  readonly handle: (event: RecordedEvent) => Effect.Effect<void, E, R>
}

/** 정책마다 마지막으로 처리한 outbox `seq`입니다. 처음이면 0입니다. */
export class PolicyCursor extends Context.Service<
  PolicyCursor,
  {
    get(policy: string): Effect.Effect<number>
    /** SQL 구현은 호출한 쪽의 트랜잭션에 함께 들어갑니다. */
    advance(policy: string, seq: number, at: string): Effect.Effect<void>
  }
>()('hemr/shared/PolicyCursor') {
  static readonly layerMemory = Layer.effect(
    PolicyCursor,
    Effect.gen(function* () {
      const cursors = yield* Ref.make(new Map<string, number>())
      return PolicyCursor.of({
        get: (policy) => Ref.get(cursors).pipe(Effect.map((all) => all.get(policy) ?? 0)),
        advance: (policy, seq) => Ref.update(cursors, (all) => new Map(all).set(policy, seq)),
      })
    }),
  )

  /** 마이그레이션 `0017`의 `policy_cursors` 테이블입니다. */
  static readonly layerSql = Layer.effect(
    PolicyCursor,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      return PolicyCursor.of({
        get: (policy) =>
          sql<{ lastSeq: number }>`SELECT last_seq AS lastSeq FROM policy_cursors WHERE policy = ${policy}`.pipe(
            Effect.map((rows) => rows[0]?.lastSeq ?? 0),
            Effect.orDie,
          ),
        advance: (policy, seq, at) =>
          sql`
            INSERT INTO policy_cursors (policy, last_seq, updated_at) VALUES (${policy}, ${seq}, ${at})
            ON CONFLICT (policy) DO UPDATE SET last_seq = excluded.last_seq, updated_at = excluded.updated_at
          `.pipe(Effect.asVoid, Effect.orDie),
      })
    }),
  )
}

/** 정책 실행기 설정입니다. */
export interface PolicyRunnerSettings {
  /** 한 회차에 읽는 이벤트 수입니다. */
  batchSize: number
  /** 폴링 간격입니다. outbox 릴레이와 같은 1초입니다. */
  pollInterval: Duration.Input
}

export const DEFAULT_POLICY_RUNNER_SETTINGS: PolicyRunnerSettings = { batchSize: 100, pollInterval: '1 second' }

/**
 * 정책 하나를 한 회차 돌리고 처리한 이벤트 수를 돌려줍니다. 커서 다음 이벤트부터 `seq` 순서로 처리합니다.
 *
 * 이벤트마다 정책의 쓰기와 커서 올리기를 한 트랜잭션에서 합니다. 거부되면 정책의 쓰기는 되돌리고 커서는 올립니다. 그래서 SQLite에서는 같은 이벤트를 두 번 처리하지
 * 않습니다(이벤트 `id`로 따로 거르지 않아도 됩니다). 되돌리지 못하는 메모리 저장소에서는 커서를 올리기 전에 죽으면
 * 다시 처리할 수 있어, 정책은 멱등이어야 합니다. 결함이 나면 그 이벤트의 쓰기를 되돌리고 회차를 멈춥니다. 뒤
 * 이벤트를 먼저 처리하면 같은 리소스의 순서가 뒤바뀌기 때문입니다(릴레이와 같은 이유).
 */
export const runPolicyOnce = <E extends { readonly _tag: string }, R>(
  policy: Policy<E, R>,
  settings: PolicyRunnerSettings = DEFAULT_POLICY_RUNNER_SETTINGS,
) =>
  Effect.gen(function* () {
    const outbox = yield* Outbox
    const cursor = yield* PolicyCursor
    const transaction = yield* Transaction
    const events = yield* outbox.after(yield* cursor.get(policy.name), settings.batchSize)
    let handled = 0
    for (const event of events) {
      const at = DateTime.formatIso(yield* DateTime.now)
      const exit = yield* Effect.exit(
        transaction.run(
          Effect.gen(function* () {
            // 정책의 처리는 안쪽 트랜잭션(savepoint)이라, 거부되면 거부 전에 쓴 것을 되돌리고 커서만 올립니다
            yield* transaction.run(policy.handle(event)).pipe(
              Effect.catch((rejection) =>
                Effect.logWarning('policy rejected', {
                  policy: policy.name,
                  seq: event.seq,
                  type: event.type,
                  subject: event.subject,
                  rejection: rejection._tag,
                }),
              ),
            )
            yield* cursor.advance(policy.name, event.seq, at)
          }),
        ),
      )
      if (Exit.isFailure(exit)) {
        yield* Effect.logError('policy failed', { policy: policy.name, seq: event.seq, type: event.type }, exit.cause)
        break
      }
      handled++
    }
    return handled
  }).pipe(Effect.withSpan('Policy.runOnce', { attributes: { policy: policy.name } }))

/**
 * 정책들을 `pollInterval`마다 돌리는 백그라운드 작업입니다. 정책마다 따로 돌아, 한 정책이 결함으로 멈춰도 다른 정책은
 * 계속합니다. 한 회차에 `batchSize`만큼 처리했으면 밀린 이벤트가 더 있을 수 있어 기다리지 않고 바로 다음 회차를
 * 돕니다. 워커는 프로세스에 하나만 둡니다 (D9).
 */
export const policyWorker = <R>(
  policies: ReadonlyArray<Policy<{ readonly _tag: string }, R>>,
  settings: PolicyRunnerSettings = DEFAULT_POLICY_RUNNER_SETTINGS,
) =>
  Layer.effectDiscard(
    Effect.forEach(
      policies,
      (policy) =>
        runPolicyOnce(policy, settings).pipe(
          Effect.repeat({ while: (handled) => handled === settings.batchSize }),
          Effect.catchCause((cause) => Effect.logError('policy run failed', { policy: policy.name }, cause)),
          Effect.repeat(Schedule.spaced(settings.pollInterval)),
          Effect.forkScoped,
        ),
      { discard: true },
    ),
  )
