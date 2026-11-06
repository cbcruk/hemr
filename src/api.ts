import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'
import { Access } from './modules/identity/auth/access.ts'
import { AuthApi, MeApi } from './modules/identity/auth/auth.api.ts'
import { EncountersApi } from './modules/clinical/encounters/encounters.api.ts'
import { ProceduresApi } from './modules/clinical/treatment-room/procedures.api.ts'
import { VisitsApi } from './modules/front-desk/visits/visits.api.ts'
import { PatientsApi } from './modules/patients/patients.api.ts'
import { RequestValidation } from './shared/problem/request-validation.ts'

/** 로드 밸런서와 로컬 개발에서 쓰는 생존 확인입니다. */
export class SystemApi extends HttpApiGroup.make('system').add(
  HttpApiEndpoint.get('health', '/health', {
    success: Schema.Struct({ status: Schema.Literal('ok') }),
  }).annotate(Access, Access.public),
) {}

/**
 * 백엔드의 HTTP 계약입니다. 모든 경로는 `/v1` 아래에 있습니다.
 *
 * 엔드포인트마다 접근 규칙(`Access`)을 선언합니다. 빠뜨리면 서버가 뜨지 않습니다(`accessViolations`).
 *
 * 요청 디코딩 실패는 `VALIDATION_FAILED` 문제(RFC 9457 Problem Details)로 응답합니다.
 * 첫 오류에서 멈추지 않고 모든 위반을 모아 한 번에 돌려줍니다.
 */
export class Api extends HttpApi.make('hemr')
  .add(SystemApi)
  .add(AuthApi)
  .add(MeApi)
  .add(PatientsApi)
  .add(VisitsApi)
  .add(EncountersApi)
  .add(ProceduresApi)
  .prefix('/v1')
  .middleware(RequestValidation)
  .annotate(HttpApi.ParseOptions, { errors: 'all' }) {}
