import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServerError, HttpServerRespondable } from 'effect/http'
import { HttpApiBuilder } from 'effect/http-api'
import { Api } from './api.ts'
import { Auth } from './modules/identity/auth/auth.ts'
import { AuthHttpLive, MeHttpLive } from './modules/identity/auth/auth.http.ts'
import { AuthenticationLive } from './modules/identity/auth/authentication.ts'
import { AuthorizationLive, accessCheck } from './modules/identity/auth/authorization.ts'
import { EncountersHttpLive } from './modules/clinical/encounters/encounters.http.ts'
import { Encounters } from './modules/clinical/encounters/encounters.ts'
import { VisitsHttpLive } from './modules/front-desk/visits/visits.http.ts'
import { Visits } from './modules/front-desk/visits/visits.ts'
import { PatientsHttpLive } from './modules/patients/patients.http.ts'
import { Patients } from './modules/patients/patients.ts'
import { Internal, NotFound } from './shared/problem/problem.ts'
import { RequestValidationLive } from './shared/problem/request-validation.ts'

const SystemLive = HttpApiBuilder.group(Api, 'system', (handlers) =>
  handlers.handle('health', () => Effect.succeed({ status: 'ok' as const })),
)

/**
 * 일치하는 경로가 없거나 예상하지 못한 오류(defect)가 나면 Problem Details로 응답합니다.
 *
 * 엔드포인트에 선언한 오류는 여기까지 오지 않고, 해당 경로가 직접 응답으로 바꿉니다.
 */
const ProblemFallback = HttpRouter.middleware(
  (httpEffect) =>
    httpEffect.pipe(
      Effect.catchIf(isRouteNotFound, () => HttpServerRespondable.toResponse(new NotFound({}))),
      Effect.catchDefect(() => HttpServerRespondable.toResponse(new Internal({}))),
    ),
  { global: true },
)

function isRouteNotFound(error: unknown): boolean {
  return error instanceof HttpServerError.HttpServerError && error.reason._tag === 'RouteNotFound'
}

/** 인증·권한 미들웨어입니다. 둘 다 같은 `Auth`를 씁니다. */
const SecurityLive = Layer.mergeAll(AuthenticationLive, AuthorizationLive).pipe(Layer.provideMerge(Auth.layer))

/**
 * HTTP 서버에 올릴 수 있는 API 전체 경로입니다.
 *
 * 저장소(`persistence.ts`), 인증 설정(`AuthConfig`), 환자 정보 암호화(`PatientCrypto`)는 호출하는 쪽이 넣습니다.
 */
export const AppLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(SystemLive),
  Layer.provide(Layer.mergeAll(AuthHttpLive, MeHttpLive)),
  // 접수(`Visits`)와 진료(`Encounters`)가 환자를 읽으므로 세 모듈이 같은 `Patients`를 씁니다
  Layer.provide(
    Layer.mergeAll(
      PatientsHttpLive,
      VisitsHttpLive.pipe(Layer.provide(Visits.layer)),
      EncountersHttpLive.pipe(Layer.provide(Encounters.layer)),
    ).pipe(Layer.provide(Patients.layer)),
  ),
  Layer.provide(SecurityLive),
  Layer.provide(RequestValidationLive),
  Layer.provide(accessCheck(Api)),
  Layer.merge(ProblemFallback),
)
