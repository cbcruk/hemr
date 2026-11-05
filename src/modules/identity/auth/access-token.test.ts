import { Option, Redacted } from 'effect'
import { describe, expect, it } from 'vitest'
import { signAccessToken, verifyAccessToken } from './access-token.ts'
import type { AccessClaims } from './access-token.ts'

const secret = Redacted.make('secret-secret-secret-secret-secret')
const claims: AccessClaims = {
  sub: 'usr_01JBQ000000000000000000001' as AccessClaims['sub'],
  sid: 'ses_01JBQ000000000000000000001' as AccessClaims['sid'],
  tid: null,
  iat: 1_000,
  exp: 1_600,
}

describe('access token', () => {
  it('round-trips until it expires', () => {
    const token = signAccessToken(secret, claims)
    expect(verifyAccessToken(secret, token, 1_599_999)).toEqual(Option.some(claims))
    expect(Option.isNone(verifyAccessToken(secret, token, 1_600_000))).toBe(true)
  })

  it('rejects another key, a changed payload or a changed header', () => {
    const token = signAccessToken(secret, claims)
    const [header, payload, signature] = token.split('.') as [string, string, string]
    const forged = Buffer.from(JSON.stringify({ ...claims, sub: 'usr_other' })).toString('base64url')
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    for (const candidate of [
      token,
      `${header}.${forged}.${signature}`,
      `${none}.${payload}.`,
      `${none}.${payload}.${signature}`,
      `${token}.extra`,
      'garbage',
    ]) {
      const key = candidate === token ? Redacted.make('another-secret-another-secret-xx') : secret
      expect(Option.isNone(verifyAccessToken(key, candidate, 1_000_000))).toBe(true)
    }
  })
})
