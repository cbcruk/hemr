import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { problemType } from '../../../shared/problem/problem.ts'

export class InvalidCredentials extends HttpApiError.Problem<InvalidCredentials>()(
  'InvalidCredentials',
  { type: problemType('INVALID_CREDENTIALS'), status: 401, title: 'Invalid login ID or password' },
  { code: Schema.tag('INVALID_CREDENTIALS') },
  {
    description:
      '`INVALID_CREDENTIALS`: 아이디가 없거나 비밀번호가 틀렸습니다. 아이디 존재 여부가 드러나지 않게 둘을 나누지 않습니다.',
  },
) {}

export class AccountLocked extends HttpApiError.Problem<AccountLocked>()(
  'AccountLocked',
  { type: problemType('ACCOUNT_LOCKED'), status: 423, title: 'Account is locked' },
  { code: Schema.tag('ACCOUNT_LOCKED') },
  {
    description:
      '`ACCOUNT_LOCKED`: 연속 로그인 실패(5회)로 잠긴 계정입니다. 잠긴 동안은 맞는 비밀번호도 거절하고, 시간이 지나도 풀리지 않습니다.',
  },
) {}

export class Unauthenticated extends HttpApiError.Problem<Unauthenticated>()(
  'Unauthenticated',
  { type: problemType('UNAUTHENTICATED'), status: 401, title: 'Authentication required' },
  { code: Schema.tag('UNAUTHENTICATED') },
  { description: '`UNAUTHENTICATED`: access token·refresh token이 없거나, 틀렸거나, 만료됐거나, 폐기된 세션입니다.' },
) {}

export class TenantAccessDenied extends HttpApiError.Problem<TenantAccessDenied>()(
  'TenantAccessDenied',
  { type: problemType('TENANT_ACCESS_DENIED'), status: 403, title: 'No active membership in this tenant' },
  { code: Schema.tag('TENANT_ACCESS_DENIED') },
  {
    description:
      '`TENANT_ACCESS_DENIED`: 유효한 소속이 없는 병원으로 전환하려 했거나, 고른 병원의 소속이 더는 유효하지 않습니다.',
  },
) {}

export class TenantNotSelected extends HttpApiError.Problem<TenantNotSelected>()(
  'TenantNotSelected',
  { type: problemType('TENANT_NOT_SELECTED'), status: 403, title: 'Select a tenant first' },
  { code: Schema.tag('TENANT_NOT_SELECTED') },
  {
    description:
      '`TENANT_NOT_SELECTED`: 병원 업무 엔드포인트인데 access token이 병원을 가리키지 않습니다. `:switch-tenant`로 먼저 골라야 합니다.',
  },
) {}

// 클라이언트도 `/me`로 자기 권한을 알고 있어, 빠진 권한 이름을 알려 줘도 새로 드러나는 것이 없습니다
export class PermissionDenied extends HttpApiError.Problem<PermissionDenied>()(
  'PermissionDenied',
  { type: problemType('PERMISSION_DENIED'), status: 403, title: 'Permission denied' },
  { code: Schema.tag('PERMISSION_DENIED'), missing: Schema.Array(Schema.String) },
  {
    description: '`PERMISSION_DENIED`: 이 요청에 필요한 권한이 없습니다. `missing`은 빠진 권한 모두입니다.',
  },
) {}
