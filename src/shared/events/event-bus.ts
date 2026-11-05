import { Context, Data, Effect, Layer, PubSub } from 'effect'
import type { Scope } from 'effect'
import type { RecordedEvent } from './domain-event.ts'

/** 버스에 이벤트를 내지 못했습니다. 릴레이가 나중에 다시 시도합니다. */
export class EventPublishError extends Data.TaggedError('EventPublishError')<{ message: string }> {}

/**
 * 모듈 사이 이벤트 버스입니다. 모듈러 모놀리스 단계에서는 같은 프로세스 안 큐이고, 모듈을 분리할 때 이 Layer만
 * 바꿉니다 (`docs/design/events.md`). 전달은 최소 1회라 소비자는 이벤트 `id`로 중복을 거릅니다.
 */
export class EventBus extends Context.Service<
  EventBus,
  {
    publish(event: RecordedEvent): Effect.Effect<void, EventPublishError>
    /** 구독을 엽니다. 스코프가 닫히면 구독도 끝납니다. */
    subscribe: Effect.Effect<PubSub.Subscription<RecordedEvent>, never, Scope.Scope>
  }
>()('hemr/shared/EventBus') {
  static readonly layerInProcess = Layer.effect(
    EventBus,
    Effect.gen(function* () {
      const pubsub = yield* PubSub.unbounded<RecordedEvent>()
      return EventBus.of({
        publish: (event) => PubSub.publish(pubsub, event).pipe(Effect.asVoid),
        subscribe: PubSub.subscribe(pubsub),
      })
    }),
  )
}
