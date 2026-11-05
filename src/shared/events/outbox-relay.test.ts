import { Effect, Layer, PubSub, Ref } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceSqlite } from '../../persistence.ts'
import { domainEvent } from './domain-event.ts'
import type { RecordedEvent } from './domain-event.ts'
import { EventBus, EventPublishError } from './event-bus.ts'
import { Outbox } from './outbox.ts'
import { DEFAULT_OUTBOX_RELAY_SETTINGS, OutboxRelay, retryDelay } from './outbox-relay.ts'
import type { OutboxRelaySettings } from './outbox-relay.ts'

const events = ['a', 'b', 'c'].map((subject, index) =>
  domainEvent('test.happened', subject, `2026-11-05T00:00:0${index}.000Z`, { index }),
)

/** 처음 `failures`번은 실패하고 그 뒤로는 받은 이벤트를 모으는 버스입니다. */
const flakyBus = (failures: number) =>
  Layer.effect(
    EventBus,
    Effect.gen(function* () {
      const left = yield* Ref.make(failures)
      const received = yield* Ref.make<ReadonlyArray<string>>([])
      return EventBus.of({
        publish: (event) =>
          Ref.getAndUpdate(left, (n) => n - 1).pipe(
            Effect.flatMap((n) =>
              n > 0
                ? Effect.fail(new EventPublishError({ message: 'down' }))
                : Ref.update(received, (all) => [...all, event.subject]),
            ),
          ),
        subscribe: Effect.die('unused'),
      })
    }),
  )

const settings: OutboxRelaySettings = { ...DEFAULT_OUTBOX_RELAY_SETTINGS, retryBase: '0 millis', retryMax: '0 millis' }

const relayWith = (bus: Layer.Layer<EventBus>, relaySettings = settings) =>
  OutboxRelay.make(relaySettings).pipe(Layer.provideMerge(bus), Layer.provideMerge(PersistenceSqlite(':memory:')))

describe('OutboxRelay', () => {
  it('publishes pending events in seq order once', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const bus = yield* EventBus
        const subscription = yield* bus.subscribe
        yield* (yield* Outbox).append(events)
        const relay = yield* OutboxRelay
        const first = yield* relay.runOnce
        const second = yield* relay.runOnce
        const received: RecordedEvent[] = []
        for (let i = 0; i < 3; i++) received.push(yield* PubSub.take(subscription))
        return { first, second, received, pending: yield* (yield* Outbox).pending(10) }
      }).pipe(Effect.scoped, Effect.provide(relayWith(EventBus.layerInProcess))),
    )
    expect(result).toMatchObject({ first: 3, second: 0, pending: [] })
    expect(result.received.map((event) => [event.seq, event.subject])).toEqual([
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ])
  })

  it('stops at a failed event and retries it before later ones', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const outbox = yield* Outbox
        yield* outbox.append(events)
        const relay = yield* OutboxRelay
        const first = yield* relay.runOnce
        const afterFailure = yield* outbox.pending(10)
        const second = yield* relay.runOnce
        return { first, afterFailure, second, pending: yield* outbox.pending(10) }
      }).pipe(Effect.provide(relayWith(flakyBus(1)))),
    )
    expect(result.first).toBe(0)
    expect(result.afterFailure.map((row) => [row.event.subject, row.attempts])).toEqual([
      ['a', 1],
      ['b', 0],
      ['c', 0],
    ])
    expect(result.second).toBe(3)
    expect(result.pending).toEqual([])
  })

  it('waits for the retry time before trying again', async () => {
    const waiting: OutboxRelaySettings = { ...DEFAULT_OUTBOX_RELAY_SETTINGS, retryBase: '1 hour', retryMax: '1 hour' }
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* (yield* Outbox).append(events)
        const relay = yield* OutboxRelay
        yield* relay.runOnce
        return { second: yield* relay.runOnce, pending: yield* (yield* Outbox).pending(10) }
      }).pipe(Effect.provide(relayWith(flakyBus(1), waiting))),
    )
    expect(result.second).toBe(0)
    expect(result.pending[0]).toMatchObject({ attempts: 1 })
  })
})

describe('retryDelay', () => {
  it('doubles from the base and stops at the cap', () => {
    expect([0, 1, 2, 8, 9, 20].map((attempts) => retryDelay(attempts))).toEqual([
      1000, 2000, 4000, 256_000, 300_000, 300_000,
    ])
  })
})

describe('OutboxRelay.polling', () => {
  /** 첫 `markPublished`에서 한 번 결함으로 죽는 outbox입니다. 그 이벤트는 다음 회차에 다시 나갑니다. */
  const dyingOutbox = Layer.effect(
    Outbox,
    Effect.gen(function* () {
      const outbox = yield* Outbox
      let died = false
      return Outbox.of({
        ...outbox,
        markPublished: (seq, at) =>
          Effect.suspend(() => {
            if (died) return outbox.markPublished(seq, at)
            died = true
            return Effect.die(new Error('disk full'))
          }),
      })
    }),
  ).pipe(Layer.provide(Outbox.layerMemory))

  it('keeps polling after a run dies', async () => {
    const fast: OutboxRelaySettings = { ...settings, pollInterval: '1 millis', batchSize: 1 }
    const pending = await Effect.runPromise(
      Effect.gen(function* () {
        const outbox = yield* Outbox
        yield* outbox.append(events)
        for (let i = 0; i < 200 && (yield* outbox.pending(10)).length > 0; i++) yield* Effect.sleep('5 millis')
        return yield* outbox.pending(10)
      }).pipe(
        Effect.provide(
          OutboxRelay.polling(fast).pipe(
            Layer.provideMerge(OutboxRelay.make(fast)),
            Layer.provideMerge(EventBus.layerInProcess),
            Layer.provideMerge(dyingOutbox),
          ),
        ),
        Effect.scoped,
      ),
    )
    expect(pending).toEqual([])
  })
})
