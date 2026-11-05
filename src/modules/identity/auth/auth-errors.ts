import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { problemType } from '../../../shared/problem/problem.ts'

/** 아이디가 없거나 비밀번호가 틀렸습니다. 아이디 존재 여부가 드러나지 않게 둘을 나누지 않습니다. */
export class InvalidCredentials extends HttpApiError.Problem<InvalidCredentials>()(
  'InvalidCredentials',
  { type: problemType('INVALID_CREDENTIALS'), status: 401, title: 'Invalid login ID or password' },
  { code: Schema.tag('INVALID_CREDENTIALS') },
) {}

/** 연속 로그인 실패로 잠긴 계정입니다. 본인확인으로 잠금을 풀어야 합니다. */
export class AccountLocked extends HttpApiError.Problem<AccountLocked>()(
  'AccountLocked',
  { type: problemType('ACCOUNT_LOCKED'), status: 423, title: 'Account is locked' },
  { code: Schema.tag('ACCOUNT_LOCKED') },
) {}

/** access token·refresh token이 없거나, 틀렸거나, 만료됐거나, 폐기된 세션입니다. */
export class Unauthenticated extends HttpApiError.Problem<Unauthenticated>()(
  'Unauthenticated',
  { type: problemType('UNAUTHENTICATED'), status: 401, title: 'Authentication required' },
  { code: Schema.tag('UNAUTHENTICATED') },
) {}

/** 유효한 소속이 없는 병원으로 전환하려 했습니다. */
export class TenantAccessDenied extends HttpApiError.Problem<TenantAccessDenied>()(
  'TenantAccessDenied',
  { type: problemType('TENANT_ACCESS_DENIED'), status: 403, title: 'No active membership in this tenant' },
  { code: Schema.tag('TENANT_ACCESS_DENIED') },
) {}
