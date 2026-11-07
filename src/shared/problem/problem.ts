import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'

/** 오류 코드로 `type` URI를 만듭니다. 예: `urn:hemr:problem:slot-full` */
export function problemType(code: string): string {
  return `urn:hemr:problem:${code.toLowerCase().replaceAll('_', '-')}`
}

export class NotFound extends HttpApiError.Problem<NotFound>()(
  'NotFound',
  { type: problemType('NOT_FOUND'), status: 404, title: 'Resource not found' },
  { code: Schema.tag('NOT_FOUND') },
  { description: '요청 경로와 메서드에 맞는 경로가 없습니다.' },
) {}

export class Internal extends HttpApiError.Problem<Internal>()(
  'Internal',
  { type: problemType('INTERNAL'), status: 500, title: 'Internal server error' },
  { code: Schema.tag('INTERNAL') },
  { description: '예상 밖의 서버 오류입니다. 서버가 오류를 기록합니다.' },
) {}

export class ValidationFailed extends HttpApiError.Problem<ValidationFailed>()(
  'ValidationFailed',
  { type: problemType('VALIDATION_FAILED'), status: 400, title: 'Request validation failed' },
  {
    code: Schema.tag('VALIDATION_FAILED'),
    violations: Schema.Array(Schema.Struct({ field: Schema.String, code: Schema.String })),
  },
  {
    description:
      '요청 경로·쿼리·헤더·본문이 스키마를 통과하지 못했습니다. `violations`는 첫 오류에서 멈추지 않고 모은 모든 위반의 필드와 코드입니다.',
  },
) {}

export class VersionMismatch extends HttpApiError.Problem<VersionMismatch>()(
  'VersionMismatch',
  { type: problemType('VERSION_MISMATCH'), status: 412, title: 'Resource was changed by someone else' },
  { code: Schema.tag('VERSION_MISMATCH'), currentVersion: Schema.Int },
  { description: '`If-Match`로 보낸 버전이 저장된 버전과 다릅니다. 다른 사람이 먼저 고쳤습니다.' },
) {}
