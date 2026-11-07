import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from 'effect/http-api'
import { Access } from './modules/identity/auth/access.ts'
import { AuthApi, MeApi } from './modules/identity/auth/auth.api.ts'
import { AmendmentProposalsApi } from './modules/clinical/encounters/amendment-proposals.api.ts'
import { EncountersApi } from './modules/clinical/encounters/encounters.api.ts'
import { ProceduresApi } from './modules/clinical/treatment-room/procedures.api.ts'
import { CashDrawersApi } from './modules/front-desk/cash-drawers/cash-drawers.api.ts'
import { PaymentsApi } from './modules/front-desk/receipts/payments.api.ts'
import { ReceiptsApi } from './modules/front-desk/receipts/receipts.api.ts'
import { VisitsApi } from './modules/front-desk/visits/visits.api.ts'
import { PatientsApi } from './modules/patients/patients.api.ts'
import { RequestValidation } from './shared/problem/request-validation.ts'

export class SystemApi extends HttpApiGroup.make('system')
  .add(
    HttpApiEndpoint.get('health', '/health', {
      success: Schema.Struct({ status: Schema.Literal('ok') }).annotate({
        description: '서버가 요청을 받을 수 있습니다.',
      }),
    })
      .annotate(Access, Access.public)
      .annotate(OpenApi.Summary, '생존 확인'),
  )
  .annotate(OpenApi.Description, '로드 밸런서와 로컬 개발에서 쓰는 생존 확인입니다.') {}

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
  .add(AmendmentProposalsApi)
  .add(ProceduresApi)
  .add(ReceiptsApi)
  .add(PaymentsApi)
  .add(CashDrawersApi)
  .prefix('/v1')
  .middleware(RequestValidation)
  .annotate(HttpApi.ParseOptions, { errors: 'all' })
  .annotate(OpenApi.Title, 'hemr')
  .annotate(
    OpenApi.Description,
    'hemr 한의원 EMR 백엔드의 HTTP API입니다. 모든 경로는 `/v1` 아래에 있습니다. 오류는 RFC 9457 문제 응답(`application/problem+json`)이고 `code`로 가립니다. 요청이 스키마를 통과하지 못하면 첫 오류에서 멈추지 않고 모든 위반을 모아 400 `VALIDATION_FAILED`로 돌려줍니다. 커맨드는 경로 끝에 `:커맨드`를 붙여 보냅니다(`POST /visits/{id}:cancel`, `POST /visits:check-in`). 로그인(`POST /auth/sessions`)으로 받은 access token을 `Authorization: Bearer`로 보내고, 병원 업무 API는 병원을 고른 토큰이 필요합니다(아니면 403 `TENANT_NOT_SELECTED`, `:switch-tenant`로 고름). 목록의 `limit` 기본값은 50이고 마지막 쪽의 `nextCursor`는 `null`입니다.',
  ) {}
