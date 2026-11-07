import { Cause, Effect, ErrorReporter } from 'effect'
import { HttpServerRespondable } from 'effect/http'
import { Internal } from './problem.ts'

/**
 * 예상 밖 오류의 원인을 오류 로그와 오류 보고자(`ErrorReporter`)에 남기고 500 `INTERNAL`로 응답합니다.
 *
 * 응답으로 바꾼 오류는 Effect HTTP 서버의 기본 보고·로그에 잡히지 않으므로 여기서 남깁니다. 응답에는 원인을 싣지
 * 않습니다.
 */
export const respondUnexpected = (cause: Cause.Cause<unknown>) =>
  Effect.logError('unexpected server error', cause).pipe(
    Effect.andThen(ErrorReporter.report(cause)),
    Effect.andThen(HttpServerRespondable.toResponse(new Internal({}))),
  )
