import { randomBytes } from 'node:crypto'
import { Context, Effect, Layer, Redacted } from 'effect'

export interface AuthSettings {
  /** access token 서명 키입니다. */
  secret: Redacted.Redacted<string>
  /** access token 수명(초)입니다. */
  accessTtlSeconds: number
  /** refresh token 수명(초)입니다. 병원 설정 `로그인유지시간`이 생기면 그 값을 씁니다. */
  refreshTtlSeconds: number
  /** 회전한 refresh token이 이 시간(초) 안에 다시 오면 탭 여러 개의 동시 refresh로 보고 세션을 두는 유예입니다. */
  refreshGraceSeconds: number
  /** 연속 실패가 이 횟수가 되면 계정을 잠급니다. */
  lockAfterFailures: number
  /** refresh 쿠키에 `Secure`를 붙입니다. 브라우저는 `localhost`를 보안 출처로 봐 로컬 개발에서도 됩니다. */
  secureCookie: boolean
}

export const DEFAULT_AUTH_SETTINGS: Omit<AuthSettings, 'secret'> = {
  accessTtlSeconds: 10 * 60,
  refreshTtlSeconds: 12 * 60 * 60,
  refreshGraceSeconds: 10,
  lockAfterFailures: 5,
  secureCookie: true,
}

/** 로컬 개발 모드입니다. 임의 서명 키와 개발 계정을 허용합니다. `pnpm dev`가 켭니다. */
export const isDevMode = () => process.env['HEMR_DEV'] === '1'

/** 인증 설정입니다. */
export class AuthConfig extends Context.Service<AuthConfig, AuthSettings>()('hemr/identity/AuthConfig') {
  static readonly layer = (settings: Partial<AuthSettings> & Pick<AuthSettings, 'secret'>) =>
    Layer.succeed(AuthConfig, { ...DEFAULT_AUTH_SETTINGS, ...settings })

  /**
   * 환경 변수 `AUTH_SECRET`(32자 이상)을 서명 키로 씁니다. 없으면 시작하지 않습니다. 로컬 개발(`HEMR_DEV=1`)에서만
   * 시작할 때마다 새 키를 만들고, 재시작하면 발급한 access token이 모두 무효가 됩니다(refresh token은 저장소에 있어
   * 그대로 씁니다).
   */
  static readonly layerFromEnv = Layer.effect(
    AuthConfig,
    Effect.gen(function* () {
      const fromEnv = process.env['AUTH_SECRET']
      if (fromEnv !== undefined && fromEnv.length < 32)
        return yield* Effect.die('AUTH_SECRET must be at least 32 characters')
      if (fromEnv === undefined && !isDevMode()) return yield* Effect.die('AUTH_SECRET is required (or set HEMR_DEV=1)')
      if (fromEnv === undefined) yield* Effect.logWarning('AUTH_SECRET is not set; using a random key for this process')
      const secret = Redacted.make(fromEnv ?? randomBytes(32).toString('base64url'))
      return { ...DEFAULT_AUTH_SETTINGS, secret }
    }),
  )
}

/** 고정 키를 쓰는 테스트용 설정입니다. */
export const TestAuthConfig = AuthConfig.layer({ secret: Redacted.make('test-secret-test-secret-test-secret') })
