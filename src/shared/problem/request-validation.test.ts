import { Cause, Effect, ErrorReporter, Layer, Logger, Schema } from 'effect'
import { HttpRouter, HttpServer } from 'effect/http'
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'
import { afterAll, describe, expect, it } from 'vitest'
import { RequestValidation, RequestValidationLive, toViolations } from './request-validation.ts'

const Payment = Schema.Struct({ amount: Schema.Int, method: Schema.Literals(['CARD', 'CASH']) })
const Checkout = Schema.Struct({ payments: Schema.Array(Payment), memo: Schema.optionalKey(Schema.String) })

function violationsOf(input: unknown) {
  const result = Schema.decodeUnknownExit(Checkout)(input, { errors: 'all' })
  if (result._tag !== 'Failure') throw new Error('expected decoding to fail')
  const issue = result.cause.reasons.find((reason) => reason._tag === 'Fail')?.error.issue
  if (issue === undefined) throw new Error('expected a schema issue')
  return toViolations(issue, 'body')
}

describe('toViolations', () => {
  it('formats nested paths as JSON paths', () => {
    expect(
      violationsOf({
        payments: [
          { amount: 1000, method: 'CARD' },
          { amount: 1.5, method: 'BANK' },
        ],
      }),
    ).toEqual([
      { field: 'payments[1].amount', code: 'INVALID_VALUE' },
      { field: 'payments[1].method', code: 'INVALID_VALUE' },
    ])
  })

  it('names missing and mistyped fields', () => {
    expect(violationsOf({ memo: 3 })).toEqual([
      { field: 'payments', code: 'REQUIRED' },
      { field: 'memo', code: 'INVALID_TYPE' },
    ])
  })

  it('uses the request part name when the whole value is wrong', () => {
    expect(violationsOf('not an object')).toEqual([{ field: 'body', code: 'INVALID_TYPE' }])
  })
})

describe('응답 인코딩 실패', () => {
  const Broken = HttpApi.make('broken')
    .add(
      HttpApiGroup.make('broken').add(
        HttpApiEndpoint.get('get', '/broken', { success: Schema.Struct({ count: Schema.Int }) }),
      ),
    )
    .middleware(RequestValidation)

  const logged: Array<{ level: string; cause: Cause.Cause<unknown> }> = []
  const reported: Array<Cause.Cause<unknown>> = []
  const app = HttpRouter.toWebHandler(
    HttpApiBuilder.layer(Broken).pipe(
      // 핸들러가 성공 Schema에 맞지 않는 값을 돌려줍니다
      Layer.provide(
        HttpApiBuilder.group(Broken, 'broken', (handlers) =>
          handlers.handle('get', () => Effect.succeed({ count: 1.5 })),
        ),
      ),
      Layer.provide(RequestValidationLive),
      Layer.provide(HttpServer.layerServices),
      // 요청을 처리하는 파이버가 쓰도록 출력 컨텍스트에 둡니다
      Layer.provideMerge(
        Layer.mergeAll(
          Logger.layer([Logger.make(({ logLevel, cause }) => void logged.push({ level: logLevel, cause }))]),
          ErrorReporter.layer([ErrorReporter.make(({ cause }) => void reported.push(cause))]),
        ),
      ),
    ),
    { disableLogger: true },
  )
  afterAll(() => app.dispose())

  it('원인을 싣지 않은 500 `INTERNAL`로 응답하고 원인은 오류 로그와 오류 보고자에 남깁니다', async () => {
    const response = await app.handler(new Request('http://localhost/broken'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      type: 'urn:hemr:problem:internal',
      title: 'Internal server error',
      status: 500,
      code: 'INTERNAL',
    })
    expect(logged.filter((each) => each.level === 'Error')).toHaveLength(1)
    expect(reported).toHaveLength(1)
  })
})
