import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from 'effect/http-api'
import { TenantId } from '../identity.ts'
import { Access } from './access.ts'
import { AccountLocked, InvalidCredentials, TenantAccessDenied, Unauthenticated } from './auth-errors.ts'
import { Authentication } from './authentication.ts'

const AccessToken = {
  accessToken: Schema.String.annotate({ description: '`Authorization: Bearer`로 보내는 access token입니다.' }),
  expiresIn: Schema.Int.annotate({ description: 'access token 수명(초)입니다.' }),
}

const UserSummary = Schema.Struct({
  id: Schema.String,
  loginId: Schema.String,
  name: Schema.String,
  licenseType: Schema.NullOr(Schema.Literals(['KOREAN_MEDICINE_DOCTOR', 'PHARMACIST'])).annotate({
    description:
      '면허 종류입니다. 한의사(`KOREAN_MEDICINE_DOCTOR`), 약사(`PHARMACIST`)이고, 면허가 없으면 `null`입니다.',
  }),
}).annotate({ identifier: 'UserSummary', description: '로그인한 사용자입니다.' })

const Role = Schema.Literals(['OWNER_DOCTOR', 'ASSOCIATE_DOCTOR', 'MANAGER', 'FRONT_DESK', 'THERAPIST']).annotate({
  identifier: 'Role',
  description: '병원에서의 역할입니다. 대표원장, 봉직의, 실장, 데스크, 치료사입니다.',
})

const MembershipSummary = Schema.Struct({ tenantId: Schema.String, tenantName: Schema.String, role: Role }).annotate({
  identifier: 'MembershipSummary',
  description: '병원 소속입니다.',
})

const TenantIdOrNull = Schema.NullOr(Schema.String).annotate({
  description:
    'access token이 가리키는 병원입니다. 소속이 여럿이면 `null`이고 병원 전환(`:switch-tenant`)으로 고릅니다.',
})

export const LoginResponse = Schema.Struct({
  ...AccessToken,
  user: UserSummary,
  memberships: Schema.Array(MembershipSummary).annotate({ description: '오늘 유효한 소속입니다.' }),
  tenantId: TenantIdOrNull,
}).annotate({
  description: '로그인 응답입니다. refresh token은 본문에 싣지 않고 `HttpOnly` 쿠키로 줍니다.',
})

export const MeResponse = Schema.Struct({
  user: UserSummary,
  memberships: Schema.Array(MembershipSummary),
  tenant: Schema.NullOr(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      products: Schema.Array(Schema.String).annotate({ description: '병원이 쓰는 제품입니다.' }),
      features: Schema.Array(Schema.String),
    }),
  ).annotate({ description: 'access token이 가리키는 병원입니다. 병원을 고르지 않았으면 `null`입니다.' }),
  role: Schema.NullOr(Role),
  scope: Schema.NullOr(Schema.Literals(['ALL', 'OWN'])).annotate({
    description: '볼 수 있는 환자 범위입니다. 모든 환자(`ALL`), 자기 환자(`OWN`)입니다.',
  }),
  permissions: Schema.Array(Schema.String).annotate({
    description: '계산한 권한 집합입니다. 클라이언트는 메뉴를 거르는 데만 쓰고, 판정은 서버가 합니다.',
  }),
}).annotate({ description: '로그인한 사용자 자신입니다. 앱 시작 때 한 번 받습니다.' })

/** 로그인 세션 그룹입니다. API 설명은 `OpenApi.Description`에 있습니다. */
export class AuthApi extends HttpApiGroup.make('auth')
  .add(
    HttpApiEndpoint.post('login', '/sessions', {
      payload: Schema.Struct({
        loginId: Schema.NonEmptyString.check(Schema.isMaxLength(64)).annotate({
          description: '로그인 아이디입니다. 대소문자를 가리지 않습니다.',
        }),
        // 매우 긴 입력으로 해시 계산에 시간을 쓰게 하지 않도록 길이를 제한합니다
        password: Schema.NonEmptyString.check(Schema.isMaxLength(256)).annotate({
          description: '비밀번호입니다. 256자까지입니다.',
        }),
      }),
      success: LoginResponse,
      error: [InvalidCredentials, AccountLocked],
    })
      .annotate(Access, Access.public)
      .annotate(OpenApi.Summary, '로그인'),
    HttpApiEndpoint.post('refresh', '/sessions::refresh', {
      // 탭이 보고 있던 병원입니다. 다른 탭이 병원을 바꿔도 이 탭은 그대로 둡니다
      query: { tenantId: Schema.optionalKey(TenantId) },
      success: Schema.Struct({ ...AccessToken, tenantId: TenantIdOrNull }),
      error: Unauthenticated,
    })
      .annotate(Access, Access.public)
      .annotate(OpenApi.Summary, 'access token 새로 받기')
      .annotate(
        OpenApi.Description,
        'refresh token 쿠키로 새 access token을 받습니다. 탭이 보고 있던 병원을 `?tenantId=`로 보내면 다른 탭이 병원을 바꿔도 이 탭은 그 병원에 머뭅니다.',
      ),
    HttpApiEndpoint.delete('logout', '/sessions/current', { success: HttpApiSchema.NoContent })
      .annotate(Access, Access.public)
      .annotate(OpenApi.Summary, '로그아웃')
      .annotate(
        OpenApi.Description,
        '로그인하지 않아도 부를 수 있습니다. 쿠키나 access token이 가리키는 세션이 있으면 폐기합니다.',
      ),
    HttpApiEndpoint.post('switchTenant', '/sessions::switch-tenant', {
      payload: Schema.Struct({ tenantId: TenantId }),
      success: Schema.Struct(AccessToken),
      error: TenantAccessDenied,
    })
      .middleware(Authentication)
      .annotate(Access, Access.signedIn)
      .annotate(OpenApi.Summary, '병원 전환'),
  )
  .prefix('/auth')
  .annotate(
    OpenApi.Description,
    '로그인 세션입니다. 로그인하면 access token을 본문으로, refresh token을 `HttpOnly` 쿠키로 줍니다. 소속 병원이 여럿이면 병원 전환(`:switch-tenant`)으로 고른 뒤 병원 업무 API를 부릅니다.',
  ) {}

// 앱 시작 시 한 번 받고 저장하지 않습니다
export class MeApi extends HttpApiGroup.make('me')
  .add(
    HttpApiEndpoint.get('me', '/me', { success: MeResponse })
      .middleware(Authentication)
      .annotate(Access, Access.signedIn)
      .annotate(OpenApi.Summary, '내 정보와 권한'),
  )
  .annotate(OpenApi.Description, '로그인한 사용자 자신의 소속·역할·권한입니다.') {}
