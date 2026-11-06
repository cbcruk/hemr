import { Effect, Layer, Ref, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../persistence.ts'
import { TEST_TENANT } from '../../modules/identity/auth/testing.ts'
import { idempotent, IdempotencyStore } from './idempotency.ts'

const Result = Schema.Struct({ n: Schema.Int })

describe.each([
  ['memory', () => PersistenceMemory()],
  ['sqlite', () => PersistenceSqlite(':memory:')],
] as const)('idempotent (%s)', (_, layer) => {
  const run = (now: (call: number) => string) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const calls = yield* Ref.make(0)
        const call = (request: unknown, at: string) =>
          idempotent(
            { tenantId: TEST_TENANT.id, key: 'k', operation: 'test', request, now: at, schema: Result },
            Ref.updateAndGet(calls, (n) => n + 1).pipe(Effect.map((n) => ({ n }))),
          )
        const first = yield* call({ a: 1 }, now(0))
        const replay = yield* call({ a: 1 }, now(1))
        const reused = yield* Effect.flip(call({ a: 2 }, now(1)))
        const late = yield* call({ a: 2 }, now(2))
        return { first, replay, reused: reused._tag, late, calls: yield* Ref.get(calls) }
      }).pipe(Effect.provide(Layer.fresh(layer()))),
    )

  it('replays the first response within a day and refuses a different request', async () => {
    const times = ['2026-11-06T00:00:00.000Z', '2026-11-06T23:59:59.000Z', '2026-11-07T00:00:00.000Z']
    expect(await run((call) => times[call]!)).toEqual({
      first: { n: 1 },
      replay: { n: 1 },
      reused: 'IdempotencyKeyReused',
      late: { n: 2 },
      calls: 2,
    })
  })

  it('keeps keys apart per tenant', async () => {
    const other = 'ten_01JBQ000000000000000000002' as typeof TEST_TENANT.id
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* IdempotencyStore
        yield* store.save(TEST_TENANT.id, 'k', {
          fingerprint: 'f',
          response: '{}',
          createdAt: '2026-11-06T00:00:00.000Z',
        })
        return yield* store.find(other, 'k')
      }).pipe(Effect.provide(layer())),
    )
    expect(result._tag).toBe('None')
  })
})
