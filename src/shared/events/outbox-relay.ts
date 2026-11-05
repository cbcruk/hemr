import { Context, DateTime, Duration, Effect, Layer, Schedule } from 'effect'
import { EventBus } from './event-bus.ts'
import { Outbox } from './outbox.ts'

/** 릴레이 설정입니다. */
export interface OutboxRelaySettings {
  /** 한 번에 읽는 행 수입니다. */
  batchSize: number
  /** 폴링 간격입니다. */
  pollInterval: Duration.Input
  /** 첫 재시도 대기입니다. 실패할 때마다 두 배가 됩니다. */
  retryBase: Duration.Input
  /** 재시도 대기의 상한입니다. */
  retryMax: Duration.Input
}

export const DEFAULT_OUTBOX_RELAY_SETTINGS: OutboxRelaySettings = {
  batchSize: 100,
  pollInterval: '1 second',
  retryBase: '1 second',
  retryMax: '5 minutes',
}

/** 실패 횟수에 따른 다음 재시도 대기입니다. `retryBase × 2^attempts`를 `retryMax`로 자릅니다. */
export function retryDelay(attempts: number, settings: OutboxRelaySettings = DEFAULT_OUTBOX_RELAY_SETTINGS) {
  const base = Duration.toMillis(settings.retryBase)
  const max = Duration.toMillis(settings.retryMax)
  return Math.min(base * 2 ** attempts, max)
}

/**
 * outbox 릴레이입니다. 아직 내보내지 않은 이벤트를 `seq` 순서로 버스에 냅니다.
 *
 * 한 이벤트가 실패하면 그 뒤 이벤트도 이번 회차에는 내지 않습니다. 같은 리소스의 이벤트 순서가 뒤바뀌지 않게
 * 하기 위해서입니다. 실패한 이벤트는 대기 시간이 지나야 다시 시도하고, 대기는 실패할 때마다 두 배가 되며
 * `retryMax`에서 멈춥니다. 횟수 제한은 두지 않고 `attempts`·`last_error`를 남겨 운영자가 봅니다. 워커는
 * 프로세스에 하나만 둡니다 (D9).
 */
export class OutboxRelay extends Context.Service<
  OutboxRelay,
  {
    /** 한 회차를 돌고 버스에 낸 이벤트 수를 돌려줍니다. */
    runOnce: Effect.Effect<number>
  }
>()('hemr/shared/OutboxRelay') {
  static readonly make = (settings: OutboxRelaySettings = DEFAULT_OUTBOX_RELAY_SETTINGS) =>
    Layer.effect(
      OutboxRelay,
      Effect.gen(function* () {
        const outbox = yield* Outbox
        const bus = yield* EventBus

        const runOnce = Effect.gen(function* () {
          const now = DateTime.toEpochMillis(yield* DateTime.now)
          let published = 0
          for (const row of yield* outbox.pending(settings.batchSize)) {
            if (row.nextAttemptAt !== null && Date.parse(row.nextAttemptAt) > now) break
            const result = yield* Effect.exit(bus.publish(row.event))
            if (result._tag === 'Failure') {
              const nextAttemptAt = new Date(now + retryDelay(row.attempts, settings)).toISOString()
              // 스택까지 들어가 길어질 수 있어 잘라 둡니다
              const error = result.cause.toString().slice(0, 2000)
              yield* outbox.markFailed(row.event.seq, { error, nextAttemptAt })
              yield* Effect.logWarning('outbox publish failed', { seq: row.event.seq, error })
              break
            }
            yield* outbox.markPublished(row.event.seq, new Date(now).toISOString())
            published++
          }
          return published
        }).pipe(Effect.withSpan('OutboxRelay.runOnce'))

        return OutboxRelay.of({ runOnce })
      }),
    )

  /**
   * 릴레이를 `pollInterval`마다 돌리는 백그라운드 작업입니다. Layer의 스코프가 닫히면 멈춥니다.
   *
   * 한 회차에 `batchSize`만큼 냈으면 밀린 이벤트가 더 있을 수 있어 기다리지 않고 바로 다음 회차를 돕니다. 회차가
   * DB 오류 같은 결함으로 끝나도 로그만 남기고 다음 회차를 돕니다. 그러지 않으면 폴링이 조용히 멈춰 재시작 전까지
   * 아무 이벤트도 나가지 않습니다.
   */
  static readonly polling = (settings: OutboxRelaySettings = DEFAULT_OUTBOX_RELAY_SETTINGS) =>
    Layer.effectDiscard(
      Effect.gen(function* () {
        const relay = yield* OutboxRelay
        const drain = relay.runOnce.pipe(Effect.repeat({ while: (published) => published === settings.batchSize }))
        yield* drain.pipe(
          Effect.catchCause((cause) => Effect.logError('outbox relay run failed', cause)),
          Effect.repeat(Schedule.spaced(settings.pollInterval)),
          Effect.forkScoped,
        )
      }),
    )
}
