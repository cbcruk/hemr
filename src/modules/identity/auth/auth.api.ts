import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { AccountLocked, InvalidCredentials, TenantAccessDenied, Unauthenticated } from './auth-errors.ts'
import { Authentication } from './authentication.ts'

/** 병원 ID입니다. 예: `ten_01J...` */
export const TenantId = Schema.String.pipe(Schema.refine((value): value is Id<'tenant'> => isId('tenant', value)))

const AccessToken = {
  accessToken: Schema.String,
  /** access token 수명(초)입니다. */
  expiresIn: Schema.Int,
}

const UserSummary = Schema.Struct({
  id: Schema.String,
  loginId: Schema.String,
  name: Schema.String,
  licenseType: Schema.NullOr(Schema.Literals(['KOREAN_MEDICINE_DOCTOR', 'PHARMACIST'])),
})

const Role = Schema.Literals(['OWNER_DOCTOR', 'ASSOCIATE_DOCTOR', 'MANAGER', 'FRONT_DESK', 'THERAPIST'])

const MembershipSummary = Schema.Struct({ tenantId: Schema.String, tenantName: Schema.String, role: Role })

export const LoginResponse = Schema.Struct({
  ...AccessToken,
  user: UserSummary,
  /** 오늘 유효한 소속입니다. */
  memberships: Schema.Array(MembershipSummary),
  /** access token이 가리키는 병원입니다. 소속이 여럿이면 `null`이고 테넌트 전환으로 고릅니다. */
  tenantId: Schema.NullOr(Schema.String),
})

export const MeResponse = Schema.Struct({
  user: UserSummary,
  memberships: Schema.Array(MembershipSummary),
  tenant: Schema.NullOr(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      products: Schema.Array(Schema.String),
      features: Schema.Array(Schema.String),
    }),
  ),
  role: Schema.NullOr(Role),
  scope: Schema.NullOr(Schema.Literals(['ALL', 'OWN'])),
  /** 계산한 권한 집합입니다. 클라이언트는 메뉴를 거르는 데만 쓰고, 판정은 서버가 합니다. */
  permissions: Schema.Array(Schema.String),
})

/**
 * 로그인 세션입니다 (identity-access.md 로그인과 세션). refresh token은 `HttpOnly` 쿠키로만 오가고 본문에 싣지
 * 않습니다.
 */
export class AuthApi extends HttpApiGroup.make('auth')
  .add(
    HttpApiEndpoint.post('login', '/sessions', {
      payload: Schema.Struct({
        loginId: Schema.NonEmptyString.check(Schema.isMaxLength(64)),
        /** 매우 긴 입력으로 해시 계산에 시간을 쓰게 하지 않도록 길이를 제한합니다. */
        password: Schema.NonEmptyString.check(Schema.isMaxLength(256)),
      }),
      success: LoginResponse,
      error: [InvalidCredentials, AccountLocked],
    }),
    HttpApiEndpoint.post('refresh', '/sessions::refresh', {
      /** 탭이 보고 있던 병원(`?tenantId=`)입니다. 다른 탭이 병원을 바꿔도 이 탭은 그대로 둡니다. */
      query: { tenantId: Schema.optionalKey(TenantId) },
      success: Schema.Struct({ ...AccessToken, tenantId: Schema.NullOr(Schema.String) }),
      error: Unauthenticated,
    }),
    HttpApiEndpoint.delete('logout', '/sessions/current', { success: HttpApiSchema.NoContent }),
    HttpApiEndpoint.post('switchTenant', '/sessions::switch-tenant', {
      payload: Schema.Struct({ tenantId: TenantId }),
      success: Schema.Struct(AccessToken),
      error: TenantAccessDenied,
    }).middleware(Authentication),
  )
  .prefix('/auth') {}

/** 로그인한 사용자 자신입니다. 앱 시작 시 한 번 받고 저장하지 않습니다. */
export class MeApi extends HttpApiGroup.make('me').add(
  HttpApiEndpoint.get('me', '/me', { success: MeResponse }).middleware(Authentication),
) {}
