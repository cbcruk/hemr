import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { Effect } from 'effect'

/**
 * 비밀번호 해시입니다. 외부 의존성 없이 Node `scrypt`를 씁니다. 저장 형식은 `scrypt$N$r$p$salt$hash`(salt·hash는
 * base64url)라 비용 인자를 올려도 이전 해시를 그대로 검증할 수 있습니다.
 */
const COST = { N: 16384, r: 8, p: 1 }
const KEY_LENGTH = 32

const derive = (password: string, salt: Buffer, cost: typeof COST) =>
  Effect.callback<Buffer, Error>((resume) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...cost, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      resume(error ? Effect.fail(error) : Effect.succeed(key)),
    )
  }).pipe(Effect.orDie)

export const hashPassword = (password: string) =>
  Effect.gen(function* () {
    const salt = randomBytes(16)
    const key = yield* derive(password, salt, COST)
    return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64url'), key.toString('base64url')].join('$')
  })

/** 저장한 해시와 맞는지 봅니다. 형식이 잘못된 해시는 어떤 비밀번호와도 맞지 않습니다. */
export const verifyPassword = (password: string, stored: string) =>
  Effect.gen(function* () {
    const [scheme, N, r, p, salt, hash] = stored.split('$')
    const cost = { N: Number(N), r: Number(r), p: Number(p) }
    const valid = scheme === 'scrypt' && salt !== undefined && hash !== undefined
    if (!valid || !Object.values(cost).every(Number.isSafeInteger)) return false
    const expected = Buffer.from(hash, 'base64url')
    const key = yield* derive(password, Buffer.from(salt, 'base64url'), cost)
    return key.length === expected.length && timingSafeEqual(key, expected)
  })

/**
 * 없는 아이디로 로그인할 때 검증할 해시입니다. 아이디가 있을 때와 응답 시간이 비슷해져 아이디 존재 여부가 시간으로
 * 드러나지 않습니다.
 */
export const DUMMY_PASSWORD_HASH = `scrypt$${COST.N}$${COST.r}$${COST.p}$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(KEY_LENGTH).toString('base64url')}`
