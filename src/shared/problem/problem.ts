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
  { description: '`NOT_FOUND`: 요청 경로와 메서드에 맞는 경로가 없습니다.' },
) {}

export class Internal extends HttpApiError.Problem<Internal>()(
  'Internal',
  { type: problemType('INTERNAL'), status: 500, title: 'Internal server error' },
  { code: Schema.tag('INTERNAL') },
  { description: '`INTERNAL`: 예상 밖의 서버 오류입니다.' },
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
      '`VALIDATION_FAILED`: 요청이 받을 수 없는 값입니다. 경로·쿼리·헤더·본문이 스키마를 통과하지 못했거나, 서비스의 입력 규칙(주민등록번호와 생년월일·성별 불일치 `RRN_MISMATCH`, 대표 연락처·주소 둘 이상 `MULTIPLE_PRIMARY`, 그 밖의 `INVALID_VALUE` 등)에 맞지 않습니다. `violations`는 첫 오류에서 멈추지 않고 모은 모든 위반의 필드와 코드입니다.',
  },
) {}

export class VersionMismatch extends HttpApiError.Problem<VersionMismatch>()(
  'VersionMismatch',
  { type: problemType('VERSION_MISMATCH'), status: 412, title: 'Resource was changed by someone else' },
  { code: Schema.tag('VERSION_MISMATCH'), currentVersion: Schema.Int },
  {
    description:
      '`VERSION_MISMATCH`: `If-Match`로 보냈거나 서버가 읽은 버전이 저장된 버전과 다릅니다. 다른 사람이 먼저 고쳤습니다. `currentVersion`은 지금 버전이고(0이면 그사이 지워짐), 다시 읽어 고친 뒤 보냅니다.',
  },
) {}
