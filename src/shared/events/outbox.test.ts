import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { sqliteLayer } from '../db/migrations.ts'
import { domainEvent } from './domain-event.ts'
import { Outbox } from './outbox.ts'

const events = ['a', 'b', 'c'].map((subject, index) =>
  domainEvent('test.happened', subject, `2026-11-05T00:00:0${index}.000Z`, { index }),
)

/** 메모리와 SQLite 구현이 같은 계약을 지키는지 봅니다. */
describe.each([
  ['memory', () => Outbox.layerMemory],
  ['sqlite', () => Outbox.layerSql.pipe(Layer.provide(sqliteLayer(':memory:')))],
] as const)('Outbox (%s)', (_, layer) => {
  it('numbers events in order and tracks failures and publication', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const outbox = yield* Outbox
        yield* outbox.append(events.slice(0, 2))
        yield* outbox.append(events.slice(2))
        const limited = yield* outbox.pending(2)
        yield* outbox.markFailed(1, { error: 'down', nextAttemptAt: '2026-11-05T01:00:00.000Z' })
        yield* outbox.markFailed(1, { error: 'down', nextAttemptAt: '2026-11-05T02:00:00.000Z' })
        yield* outbox.markPublished(2, '2026-11-05T00:00:05.000Z')
        return { limited, after: yield* outbox.pending(10) }
      }).pipe(Effect.provide(layer())),
    )
    expect(result.limited.map((row) => [row.event.seq, row.event.subject])).toEqual([
      [1, 'a'],
      [2, 'b'],
    ])
    expect(result.limited[0]!.event).toEqual({ ...events[0], seq: 1 })
    expect(result.after.map((row) => [row.event.seq, row.attempts, row.nextAttemptAt])).toEqual([
      [1, 2, '2026-11-05T02:00:00.000Z'],
      [3, 0, null],
    ])
  })
})
