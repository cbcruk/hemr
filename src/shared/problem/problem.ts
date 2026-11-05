import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'

/** Builds the `type` URI for an error code, such as `urn:hemr:problem:slot-full`. */
export function problemType(code: string): string {
  return `urn:hemr:problem:${code.toLowerCase().replaceAll('_', '-')}`
}

/** No route matches the request path and method. */
export class NotFound extends HttpApiError.Problem<NotFound>()(
  'NotFound',
  { type: problemType('NOT_FOUND'), status: 404, title: 'Resource not found' },
  { code: Schema.tag('NOT_FOUND') },
) {}

/** An unexpected failure that the handler did not declare. */
export class Internal extends HttpApiError.Problem<Internal>()(
  'Internal',
  { type: problemType('INTERNAL'), status: 500, title: 'Internal server error' },
  { code: Schema.tag('INTERNAL') },
) {}
