import { createHmac, timingSafeEqual } from 'node:crypto'
import { Option, Redacted } from 'effect'
import type { Id } from '../../../shared/ids/ids.types.ts'

/** access token에 담는 값입니다. 권한은 담지 않고 요청마다 저장소에서 계산합니다. */
export interface AccessClaims {
  /** 사용자입니다. */
  sub: Id<'user'>
  /** 세션입니다. 로그아웃·재사용 감지로 폐기한 세션의 토큰은 만료 전이라도 받지 않습니다. */
  sid: Id<'session'>
  /** 고른 병원입니다. 소속이 여럿이면 로그인 직후에는 `null`이고 테넌트 전환으로 고릅니다. */
  tid: Id<'tenant'> | null
  /** 발급·만료 시각(epoch 초)입니다. */
  iat: number
  exp: number
}

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')

const sign = (secret: Redacted.Redacted<string>, body: string) =>
  createHmac('sha256', Redacted.value(secret)).update(body).digest()

/** HS256 JWT로 서명합니다. 서버 하나가 발급과 검증을 함께 하므로 대칭 키로 충분합니다. */
export function signAccessToken(secret: Redacted.Redacted<string>, claims: AccessClaims): string {
  const body = `${HEADER}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`
  return `${body}.${sign(secret, body).toString('base64url')}`
}

/** 서명과 만료를 확인합니다. 헤더가 다르거나(알고리즘 바꿔치기), 서명이 틀리거나, 만료됐으면 `none`입니다. */
export function verifyAccessToken(
  secret: Redacted.Redacted<string>,
  token: string,
  nowMillis: number,
): Option.Option<AccessClaims> {
  const [header, payload, signature, ...rest] = token.split('.')
  if (header !== HEADER || payload === undefined || signature === undefined || rest.length > 0) return Option.none()
  // 디코딩한 바이트가 아니라 문자열을 비교합니다. base64url 디코더는 잘못된 문자를 건너뛰어 다른 문자열도 통과시킵니다
  const expected = Buffer.from(sign(secret, `${header}.${payload}`).toString('base64url'))
  const actual = Buffer.from(signature)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return Option.none()
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AccessClaims
    return typeof claims.exp === 'number' && nowMillis < claims.exp * 1000 ? Option.some(claims) : Option.none()
  } catch {
    return Option.none()
  }
}
