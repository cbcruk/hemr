import { Cause, Effect, SchemaIssue } from 'effect'
import { HttpApiMiddleware } from 'effect/http-api'
import type { HttpApiError } from 'effect/http-api'
import { Internal, ValidationFailed } from './problem.ts'
import type { Violation } from './problem.types.ts'
import { respondUnexpected } from './unexpected-error.ts'

/**
 * 요청 디코딩 실패를 hemr 형식의 `VALIDATION_FAILED` 문제로 응답하는 미들웨어입니다.
 *
 * Effect 기본 `HttpApiMiddleware.ProblemDetails`를 대신합니다. 기본 미들웨어는
 * `type: about:blank`에 `code`가 없어 프로젝트 오류 규약과 맞지 않습니다.
 */
export class RequestValidation extends HttpApiMiddleware.Service<RequestValidation>()('hemr/RequestValidation', {
  error: [ValidationFailed, Internal],
}) {}

/** {@link RequestValidation} 구현입니다. */
export const RequestValidationLive = HttpApiMiddleware.layerSchemaErrorTransform(RequestValidation, (error) => {
  // `Body`와 `ResponseHeaders`는 응답 인코딩 실패라 클라이언트 잘못이 아닙니다.
  if (error.kind === 'Body' || error.kind === 'ResponseHeaders') {
    return respondUnexpected(Cause.fail(error))
  }
  return Effect.fail(new ValidationFailed({ violations: toViolations(error.cause.issue, SLOT_NAMES[error.kind]) }))
})

/** 요청 값 전체가 잘못됐을 때 `field`에 쓰는 요청 부분 이름입니다. */
const SLOT_NAMES: Record<HttpApiError.HttpApiSchemaError['kind'], string> = {
  Params: 'path',
  Query: 'query',
  Headers: 'headers',
  Payload: 'body',
  Body: 'body',
  ResponseHeaders: 'headers',
}

/**
 * Schema 오류 트리를 필드별 위반 목록으로 펼칩니다.
 *
 * 경로가 없는 위반(예: 본문이 객체가 아님)은 `field`에 요청 부분 이름(`body` 등)을 씁니다.
 */
export function toViolations(issue: SchemaIssue.Issue, root: string): Violation[] {
  const violations: Violation[] = []
  const visit = (node: SchemaIssue.Issue, path: ReadonlyArray<PropertyKey>): void => {
    switch (node._tag) {
      case 'Pointer':
        return visit(node.issue, [...path, ...node.path])
      case 'Composite':
        return node.issues.forEach((child) => visit(child, path))
      case 'AnyOf':
        if (node.issues.length === 0) violations.push({ field: formatPath(path, root), code: 'INVALID_VALUE' })
        return node.issues.forEach((child) => visit(child, path))
      case 'Encoding':
        return visit(node.issue, path)
      default:
        violations.push({ field: formatPath(path, root), code: VIOLATION_CODES[node._tag] })
    }
  }
  visit(issue, [])
  return violations
}

const VIOLATION_CODES: Record<SchemaIssue.Leaf['_tag'] | 'Filter', string> = {
  MissingKey: 'REQUIRED',
  UnexpectedKey: 'UNKNOWN_FIELD',
  InvalidType: 'INVALID_TYPE',
  InvalidValue: 'INVALID_VALUE',
  Filter: 'INVALID_VALUE',
  Forbidden: 'INVALID_VALUE',
  OneOf: 'INVALID_VALUE',
}

/** `['payments', 0, 'amount']`를 `payments[0].amount`로 바꿉니다. */
function formatPath(path: ReadonlyArray<PropertyKey>, root: string): string {
  if (path.length === 0) return root
  return path.reduce<string>((field, key) => {
    if (typeof key === 'number') return `${field}[${key}]`
    return field === '' ? String(key) : `${field}.${String(key)}`
  }, '')
}
