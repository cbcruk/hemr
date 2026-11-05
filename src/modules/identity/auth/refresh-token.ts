import { createHash, randomBytes } from 'node:crypto'

/** 새 refresh token입니다. 256비트 난수이고 쿠키로만 오갑니다. */
export const newRefreshToken = () => randomBytes(32).toString('base64url')

/** 저장소에는 refresh token 원문 대신 SHA-256 값만 둡니다. DB가 새도 토큰을 쓸 수 없습니다. */
export const refreshTokenHash = (token: string) => createHash('sha256').update(token).digest('base64url')
