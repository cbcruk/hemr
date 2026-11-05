import { Context, Effect, Layer, Option, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { Id } from '../../../shared/ids/ids.types.ts'

/** 비밀번호와 로그인 실패 상태입니다. 사용자 정보와 따로 둬, 사용자를 읽는 코드가 해시를 만지지 않게 합니다. */
export interface Credential {
  userId: Id<'user'>
  passwordHash: string
  /** 마지막 성공 뒤 연속 실패 횟수입니다. */
  failedAttempts: number
  /** 잠근 시각입니다. 잠금 해제(본인확인)로만 풀립니다. */
  lockedAt: string | null
}

/** 로그인 세션입니다. refresh token 계열 하나가 세션 하나입니다. */
export interface Session {
  id: Id<'session'>
  userId: Id<'user'>
  /** 고른 병원입니다. refresh로 새 access token을 줄 때 이 병원으로 줍니다. */
  tenantId: Id<'tenant'> | null
  createdAt: string
  revokedAt: string | null
}

export interface RefreshTokenRecord {
  hash: string
  expiresAt: string
}

/**
 * refresh token 회전 결과입니다.
 *
 * - `Rotated`: 새 토큰으로 바꿨습니다
 * - `Concurrent`: 방금(유예 시간 안) 바꾼 토큰이 다시 왔습니다. 탭 여러 개가 함께 refresh한 경우라 세션은 그대로
 *   두고, 새 토큰은 만들지 않습니다
 * - `Reused`: 유예 시간이 지난 뒤 이미 쓴 토큰이 왔습니다. 탈취로 보고 세션(계열)을 폐기했습니다
 * - `Invalid`: 모르는 토큰이거나, 만료됐거나, 이미 폐기한 세션입니다
 */
export type RotateResult =
  | { _tag: 'Rotated'; session: Session }
  | { _tag: 'Concurrent'; session: Session }
  | { _tag: 'Reused'; session: Session }
  | { _tag: 'Invalid' }

export interface RotateInput {
  presented: string
  next: RefreshTokenRecord
  now: string
  /** 이 시각 뒤에 쓴 토큰이 다시 오면 `Concurrent`입니다. */
  graceFrom: string
}

/**
 * 인증 저장소입니다. 비밀번호, 세션, refresh token(해시)을 둡니다. 회전은 한 번에(원자적으로) 판정하고 바꿔, 같은
 * 토큰으로 동시에 들어온 두 요청이 둘 다 `Rotated`를 받지 않습니다.
 */
export class AuthRepository extends Context.Service<
  AuthRepository,
  {
    findCredential(userId: Id<'user'>): Effect.Effect<Option.Option<Credential>>
    /** 비밀번호를 바꾸고 실패 횟수와 잠금을 풉니다. */
    savePassword(userId: Id<'user'>, passwordHash: string): Effect.Effect<void>
    /** 실패를 하나 더하고, `lockAfter`번째 실패면 잠급니다. 바뀐 상태를 돌려줍니다. 비밀번호가 없으면 `none`입니다. */
    recordFailedLogin(userId: Id<'user'>, at: string, lockAfter: number): Effect.Effect<Option.Option<Credential>>
    /**
     * 비밀번호를 맞힌 로그인을 마칩니다. 잠기지 않았으면 실패 횟수를 0으로 두고 `true`, 그 사이 잠겼으면 `false`입니다.
     * 잠금 확인과 초기화를 한 번에 해, 비밀번호를 검증하는 동안 다른 요청이 잠근 계정에 세션이 생기지 않습니다.
     */
    completeLogin(userId: Id<'user'>): Effect.Effect<boolean>
    createSession(session: Session, refresh: RefreshTokenRecord): Effect.Effect<void>
    findSession(id: Id<'session'>): Effect.Effect<Option.Option<Session>>
    rotateRefreshToken(input: RotateInput): Effect.Effect<RotateResult>
    revokeSession(id: Id<'session'>, at: string): Effect.Effect<Option.Option<Session>>
    /** 사용자의 세션을 모두 폐기합니다. 계정을 잠글 때 씁니다. */
    revokeSessionsOf(userId: Id<'user'>, at: string): Effect.Effect<void>
    /** refresh token이 속한 세션을 폐기합니다. 이번에 폐기한 세션을 돌려주고, 없거나 이미 폐기됐으면 `none`입니다. */
    revokeByRefreshToken(hash: string, at: string): Effect.Effect<Option.Option<Session>>
    switchTenant(sessionId: Id<'session'>, tenantId: Id<'tenant'>): Effect.Effect<void>
  }
>()('hemr/identity/AuthRepository') {
  static readonly layerMemory = Layer.effect(
    AuthRepository,
    Effect.gen(function* () {
      interface TokenRow extends RefreshTokenRecord {
        sessionId: Id<'session'>
        usedAt: string | null
      }
      interface State {
        credentials: Map<string, Credential>
        sessions: Map<string, Session>
        tokens: Map<string, TokenRow>
      }
      const state = yield* Ref.make<State>({ credentials: new Map(), sessions: new Map(), tokens: new Map() })
      const withSessions = (all: State, sessions: Map<string, Session>): State => ({ ...all, sessions })
      const revoke = (all: State, session: Session, at: string): [Session, State] => {
        const revoked = { ...session, revokedAt: at }
        return [revoked, withSessions(all, new Map(all.sessions).set(session.id, revoked))]
      }

      return AuthRepository.of({
        findCredential: (userId) =>
          Ref.get(state).pipe(
            Effect.map((all) => Option.map(Option.fromNullishOr(all.credentials.get(userId)), (c) => ({ ...c }))),
          ),
        savePassword: (userId, passwordHash) =>
          Ref.update(state, (all) => ({
            ...all,
            credentials: new Map(all.credentials).set(userId, {
              userId,
              passwordHash,
              failedAttempts: 0,
              lockedAt: null,
            }),
          })),
        recordFailedLogin: (userId, at, lockAfter) =>
          Ref.modify(state, (all): [Option.Option<Credential>, State] => {
            const current = all.credentials.get(userId)
            if (current === undefined) return [Option.none(), all]
            const failedAttempts = current.failedAttempts + 1
            const lockedAt = current.lockedAt ?? (failedAttempts >= lockAfter ? at : null)
            const next = { ...current, failedAttempts, lockedAt }
            return [Option.some({ ...next }), { ...all, credentials: new Map(all.credentials).set(userId, next) }]
          }),
        completeLogin: (userId) =>
          Ref.modify(state, (all): [boolean, State] => {
            const current = all.credentials.get(userId)
            if (current === undefined || current.lockedAt !== null) return [false, all]
            return [
              true,
              { ...all, credentials: new Map(all.credentials).set(userId, { ...current, failedAttempts: 0 }) },
            ]
          }),
        createSession: (session, refresh) =>
          Ref.update(state, (all) => ({
            ...all,
            sessions: new Map(all.sessions).set(session.id, { ...session }),
            tokens: new Map(all.tokens).set(refresh.hash, { ...refresh, sessionId: session.id, usedAt: null }),
          })),
        findSession: (id) =>
          Ref.get(state).pipe(
            Effect.map((all) => Option.map(Option.fromNullishOr(all.sessions.get(id)), (s) => ({ ...s }))),
          ),
        rotateRefreshToken: ({ presented, next, now, graceFrom }) =>
          Ref.modify(state, (all): [RotateResult, State] => {
            const token = all.tokens.get(presented)
            const session = token && all.sessions.get(token.sessionId)
            if (token === undefined || session === undefined || session.revokedAt !== null)
              return [{ _tag: 'Invalid' }, all]
            if (token.usedAt !== null) {
              if (token.usedAt > graceFrom) return [{ _tag: 'Concurrent', session: { ...session } }, all]
              const [revoked, after] = revoke(all, session, now)
              return [{ _tag: 'Reused', session: revoked }, after]
            }
            if (token.expiresAt <= now) return [{ _tag: 'Invalid' }, all]
            const tokens = new Map(all.tokens)
              .set(presented, { ...token, usedAt: now })
              .set(next.hash, { ...next, sessionId: session.id, usedAt: null })
            return [
              { _tag: 'Rotated', session: { ...session } },
              { ...all, tokens },
            ]
          }),
        revokeSession: (id, at) =>
          Ref.modify(state, (all): [Option.Option<Session>, State] => {
            const session = all.sessions.get(id)
            if (session === undefined || session.revokedAt !== null) return [Option.none(), all]
            const [revoked, after] = revoke(all, session, at)
            return [Option.some(revoked), after]
          }),
        revokeSessionsOf: (userId, at) =>
          Ref.update(state, (all) => {
            const sessions = new Map(all.sessions)
            for (const session of sessions.values()) {
              if (session.userId === userId && session.revokedAt === null)
                sessions.set(session.id, { ...session, revokedAt: at })
            }
            return withSessions(all, sessions)
          }),
        revokeByRefreshToken: (hash, at) =>
          Ref.modify(state, (all): [Option.Option<Session>, State] => {
            const token = all.tokens.get(hash)
            const session = token && all.sessions.get(token.sessionId)
            if (session === undefined || session.revokedAt !== null) return [Option.none(), all]
            const [revoked, after] = revoke(all, session, at)
            return [Option.some(revoked), after]
          }),
        switchTenant: (sessionId, tenantId) =>
          Ref.update(state, (all) => {
            const session = all.sessions.get(sessionId)
            if (session === undefined) return all
            return withSessions(all, new Map(all.sessions).set(sessionId, { ...session, tenantId }))
          }),
      })
    }),
  )

  /** SQL 테이블 `credentials`·`sessions`·`refresh_tokens`에 보관합니다. 마이그레이션 `0003`이 만듭니다. */
  static readonly layerSql = Layer.effect(
    AuthRepository,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const sessionColumns = sql`s.id, s.user_id AS userId, s.tenant_id AS tenantId, s.created_at AS createdAt,
        s.revoked_at AS revokedAt`
      const revoke = (sessionId: string, at: string) =>
        sql<Session>`
          UPDATE sessions SET revoked_at = ${at} WHERE id = ${sessionId} AND revoked_at IS NULL
          RETURNING id, user_id AS userId, tenant_id AS tenantId, created_at AS createdAt, revoked_at AS revokedAt
        `

      return AuthRepository.of({
        findCredential: (userId) =>
          sql<Credential>`
            SELECT user_id AS userId, password_hash AS passwordHash, failed_attempts AS failedAttempts,
              locked_at AS lockedAt
            FROM credentials WHERE user_id = ${userId}
          `.pipe(
            Effect.map((rows) => Option.fromNullishOr(rows[0])),
            Effect.orDie,
          ),
        savePassword: (userId, passwordHash) =>
          sql`
            INSERT INTO credentials ${sql.insert({ user_id: userId, password_hash: passwordHash, failed_attempts: 0 })}
            ON CONFLICT (user_id) DO UPDATE SET password_hash = excluded.password_hash, failed_attempts = 0,
              locked_at = NULL
          `.pipe(Effect.asVoid, Effect.orDie),
        // 읽고 쓰는 사이에 다른 실패가 끼어들지 않게 한 문장으로 셉니다
        recordFailedLogin: (userId, at, lockAfter) =>
          sql<Credential>`
            UPDATE credentials SET failed_attempts = failed_attempts + 1,
              locked_at = COALESCE(locked_at, CASE WHEN failed_attempts + 1 >= ${lockAfter} THEN ${at} END)
            WHERE user_id = ${userId}
            RETURNING user_id AS userId, password_hash AS passwordHash, failed_attempts AS failedAttempts,
              locked_at AS lockedAt
          `.pipe(
            Effect.map((rows) => Option.fromNullishOr(rows[0])),
            Effect.orDie,
          ),
        completeLogin: (userId) =>
          sql`
            UPDATE credentials SET failed_attempts = 0 WHERE user_id = ${userId} AND locked_at IS NULL
            RETURNING user_id
          `.pipe(
            Effect.map((rows) => rows.length > 0),
            Effect.orDie,
          ),
        createSession: (session, refresh) =>
          Effect.gen(function* () {
            yield* sql`
              INSERT INTO sessions ${sql.insert({
                id: session.id,
                user_id: session.userId,
                tenant_id: session.tenantId,
                created_at: session.createdAt,
                revoked_at: session.revokedAt,
              })}
            `
            yield* sql`
              INSERT INTO refresh_tokens ${sql.insert({
                token_hash: refresh.hash,
                session_id: session.id,
                expires_at: refresh.expiresAt,
              })}
            `
          }).pipe(sql.withTransaction, Effect.orDie),
        findSession: (id) =>
          sql<Session>`SELECT ${sessionColumns} FROM sessions AS s WHERE s.id = ${id}`.pipe(
            Effect.map((rows) => Option.fromNullishOr(rows[0])),
            Effect.orDie,
          ),
        rotateRefreshToken: ({ presented, next, now, graceFrom }) =>
          Effect.gen(function* () {
            const [row] = yield* sql<Session & { expiresAt: string; usedAt: string | null }>`
              SELECT ${sessionColumns}, t.expires_at AS expiresAt, t.used_at AS usedAt
              FROM refresh_tokens AS t JOIN sessions AS s ON s.id = t.session_id
              WHERE t.token_hash = ${presented}
            `
            if (row === undefined || row.revokedAt !== null) return { _tag: 'Invalid' } as const
            const { expiresAt, usedAt, ...session } = row
            if (usedAt !== null) {
              if (usedAt > graceFrom) return { _tag: 'Concurrent', session } as const
              const [revoked] = yield* revoke(session.id, now)
              return { _tag: 'Reused', session: revoked ?? session } as const
            }
            if (expiresAt <= now) return { _tag: 'Invalid' } as const
            // 트랜잭션이 한 번에 하나씩 돌지 않는 연결 방식이 되어도 한 토큰을 두 번 바꾸지 않게 조건을 겁니다
            const marked = yield* sql`
              UPDATE refresh_tokens SET used_at = ${now} WHERE token_hash = ${presented} AND used_at IS NULL
              RETURNING token_hash
            `
            if (marked.length === 0) return { _tag: 'Concurrent', session } as const
            yield* sql`
              INSERT INTO refresh_tokens ${sql.insert({
                token_hash: next.hash,
                session_id: session.id,
                expires_at: next.expiresAt,
              })}
            `
            return { _tag: 'Rotated', session } as const
          }).pipe(sql.withTransaction, Effect.orDie),
        revokeSession: (id, at) =>
          revoke(id, at).pipe(
            Effect.map((rows) => Option.fromNullishOr(rows[0])),
            Effect.orDie,
          ),
        revokeSessionsOf: (userId, at) =>
          sql`UPDATE sessions SET revoked_at = ${at} WHERE user_id = ${userId} AND revoked_at IS NULL`.pipe(
            Effect.asVoid,
            Effect.orDie,
          ),
        revokeByRefreshToken: (hash, at) =>
          sql<{
            sessionId: string
          }>`SELECT session_id AS sessionId FROM refresh_tokens WHERE token_hash = ${hash}`.pipe(
            Effect.flatMap(([row]) => (row === undefined ? Effect.succeed([]) : revoke(row.sessionId, at))),
            Effect.map((rows) => Option.fromNullishOr(rows[0])),
            Effect.orDie,
          ),
        switchTenant: (sessionId, tenantId) =>
          sql`UPDATE sessions SET tenant_id = ${tenantId} WHERE id = ${sessionId}`.pipe(Effect.asVoid, Effect.orDie),
      })
    }),
  )
}
