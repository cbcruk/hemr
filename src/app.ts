import { Hono } from 'hono'
import { PROBLEM_CONTENT_TYPE, ProblemError } from './shared/problem/problem.ts'

/**
 * Creates the HTTP application with all routes mounted under `/v1`.
 *
 * Errors are always rendered as RFC 9457 Problem Details.
 */
export function createApp(): Hono {
  const app = new Hono().basePath('/v1')

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.notFound(() => problemResponse(new ProblemError({ status: 404, code: 'NOT_FOUND', title: 'Resource not found' })))

  app.onError((error) =>
    problemResponse(
      error instanceof ProblemError
        ? error
        : new ProblemError({ status: 500, code: 'INTERNAL', title: 'Internal server error' }),
    ),
  )

  return app
}

function problemResponse(error: ProblemError): Response {
  return new Response(JSON.stringify(error), {
    status: error.status,
    headers: { 'content-type': PROBLEM_CONTENT_TYPE },
  })
}
