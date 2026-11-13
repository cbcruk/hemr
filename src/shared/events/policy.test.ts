import { Data, Effect, Exit, Ref } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../persistence.ts'
import { domainEvent } from './domain-event.ts'
import type { RecordedEvent } from './domain-event.ts'
import { Transaction } from '../db/transaction.ts'
import { Outbox } from './outbox.ts'
import { PolicyCursor, runPolicyOnce } from './policy.ts'
import type { Policy } from './policy.ts'

class Refused extends Data.TaggedError('Refused')<{}> {}

const happened = (subjects: ReadonlyArray<string>) =>
  subjects.map((subject, index) => domainEvent('test.happened', subject, `2026-11-05T00:00:0${index}.000Z`, { index }))

/** 받은 이벤트의 `subject`를 모으는 정책입니다. `refuse`는 거부하고 `crash`는 결함을 냅니다. */
const collecting = (name: string, seen: Ref.Ref<ReadonlyArray<string>>): Policy<Refused, never> => ({
  name,
  handle: (event: RecordedEvent) =>
    Effect.gen(function* () {
      if (event.subject === 'refuse') return yield* new Refused()
      if (event.subject === 'crash') return yield* Effect.die('boom')
      yield* Ref.update(seen, (all) => [...all, event.subject])
    }),
})

const run = <A, E>(program: Effect.Effect<A, E, Outbox | PolicyCursor | Transaction>, store: 'memory' | 'sqlite') =>
  Effect.runPromise(
    program.pipe(Effect.provide(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:'))),
  )

describe.each(['memory', 'sqlite'] as const)('정책 실행기 (%s)', (store) => {
  it('커서 다음 이벤트부터 seq 순서로 한 번씩 처리합니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const seen = yield* Ref.make<ReadonlyArray<string>>([])
        const policy = collecting('test-policy', seen)
        yield* (yield* Outbox).append(happened(['a', 'b']))
        const first = yield* runPolicyOnce(policy)
        yield* (yield* Outbox).append(happened(['c']))
        const second = yield* runPolicyOnce(policy)
        const third = yield* runPolicyOnce(policy)
        return {
          first,
          second,
          third,
          seen: yield* Ref.get(seen),
          cursor: yield* (yield* PolicyCursor).get(policy.name),
        }
      }),
      store,
    )
    expect(result).toEqual({ first: 2, second: 1, third: 0, seen: ['a', 'b', 'c'], cursor: 3 })
  })

  it('받는 쪽이 거부하면 기록만 하고 다음 이벤트로 넘어갑니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const seen = yield* Ref.make<ReadonlyArray<string>>([])
        yield* (yield* Outbox).append(happened(['a', 'refuse', 'b']))
        const handled = yield* runPolicyOnce(collecting('test-policy', seen))
        return { handled, seen: yield* Ref.get(seen), cursor: yield* (yield* PolicyCursor).get('test-policy') }
      }),
      store,
    )
    expect(result).toEqual({ handled: 3, seen: ['a', 'b'], cursor: 3 })
  })

  it('결함이 나면 그 이벤트에서 멈추고 커서를 올리지 않습니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const seen = yield* Ref.make<ReadonlyArray<string>>([])
        yield* (yield* Outbox).append(happened(['a', 'crash', 'b']))
        const policy = collecting('test-policy', seen)
        const first = yield* runPolicyOnce(policy)
        const again = yield* runPolicyOnce(policy)
        return { first, again, seen: yield* Ref.get(seen), cursor: yield* (yield* PolicyCursor).get(policy.name) }
      }),
      store,
    )
    expect(result).toEqual({ first: 1, again: 0, seen: ['a'], cursor: 1 })
  })

  it('정책마다 커서를 따로 둡니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const seen = yield* Ref.make<ReadonlyArray<string>>([])
        yield* (yield* Outbox).append(happened(['a', 'b']))
        yield* runPolicyOnce(collecting('first-policy', seen))
        yield* runPolicyOnce(collecting('second-policy', seen))
        return yield* Ref.get(seen)
      }),
      store,
    )
    expect(result).toEqual(['a', 'b', 'a', 'b'])
  })
})

describe('정책 실행기 (sqlite)', () => {
  it('결함이 난 이벤트의 정책 쓰기는 커서와 함께 되돌립니다', async () => {
    const result = await run(
      Effect.gen(function* () {
        const outbox = yield* Outbox
        yield* outbox.append(happened(['crash']))
        // 정책이 이벤트를 쓰고 나서 결함이 납니다
        const writesThenCrashes: Policy<never, Outbox> = {
          name: 'test-policy',
          handle: (event) =>
            event.type === 'test.happened'
              ? outbox
                  .append([domainEvent('test.reacted', event.subject, event.time, {})])
                  .pipe(Effect.andThen(Effect.die('boom')))
              : Effect.void,
        }
        const exit = yield* Effect.exit(runPolicyOnce(writesThenCrashes))
        return {
          exit,
          types: (yield* outbox.after(0, 10)).map((event) => event.type),
          cursor: yield* (yield* PolicyCursor).get('test-policy'),
        }
      }),
      'sqlite',
    )
    expect(Exit.isSuccess(result.exit)).toBe(true)
    expect(result.types).toEqual(['test.happened'])
    expect(result.cursor).toBe(0)
  })
})
