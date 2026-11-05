import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'

/** 오류 코드로 `type` URI를 만듭니다. 예: `urn:hemr:problem:slot-full` */
export function problemType(code: string): string {
  return `urn:hemr:problem:${code.toLowerCase().replaceAll('_', '-')}`
}

/** 요청 경로와 메서드에 맞는 경로가 없습니다. */
export class NotFound extends HttpApiError.Problem<NotFound>()(
  'NotFound',
  { type: problemType('NOT_FOUND'), status: 404, title: 'Resource not found' },
  { code: Schema.tag('NOT_FOUND') },
) {}

/** 핸들러가 선언하지 않은 예상 밖의 실패입니다. */
export class Internal extends HttpApiError.Problem<Internal>()(
  'Internal',
  { type: problemType('INTERNAL'), status: 500, title: 'Internal server error' },
  { code: Schema.tag('INTERNAL') },
) {}
