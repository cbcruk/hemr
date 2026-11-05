import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './password.ts'

describe('password hashing', () => {
  it('verifies the same password and rejects another', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const hash = yield* hashPassword('correct horse')
        const again = yield* hashPassword('correct horse')
        return {
          hash,
          salted: hash !== again,
          ok: yield* verifyPassword('correct horse', hash),
          wrong: yield* verifyPassword('correct horsE', hash),
        }
      }),
    )
    expect(result.hash).toMatch(/^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/)
    expect(result.hash).not.toContain('correct')
    expect(result).toMatchObject({ salted: true, ok: true, wrong: false })
  })

  it('never matches a malformed hash or the dummy hash', async () => {
    const results = await Effect.runPromise(
      Effect.all([
        verifyPassword('x', 'plain-text'),
        verifyPassword('x', 'scrypt$abc$8$1$c2FsdA$aGFzaA'),
        verifyPassword('', DUMMY_PASSWORD_HASH),
      ]),
    )
    expect(results).toEqual([false, false, false])
  })
})
