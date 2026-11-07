import { Cause, Effect, ErrorReporter, Layer, Logger } from 'effect'
import { HttpRouter, HttpServer } from 'effect/http'
import { afterAll, describe, expect, it } from 'vitest'
import { TestAuthConfig } from './modules/identity/auth/auth-config.ts'
import { TestPatientCrypto } from './modules/patients/patient-crypto.ts'
import { AppLive } from './app.ts'
import { PersistenceMemory } from './persistence.ts'

// 오류 보고자는 같은 오류 객체를 한 번만 보고하므로 요청마다 새로 만듭니다
const Defect = HttpRouter.add(
  'GET',
  '/v1/defect',
  Effect.suspend(() => Effect.die(new Error('boom'))),
)

/** 오류 로그와 오류 보고자에 닿은 원인을 모읍니다. */
const logged: Array<{ level: string; cause: Cause.Cause<unknown> }> = []
const reported: Array<Cause.Cause<unknown>> = []
const captureLogs = Logger.make(({ logLevel, cause }) => {
  logged.push({ level: logLevel, cause })
})
const captureReports = ErrorReporter.make(({ cause }) => {
  reported.push(cause)
})

const app = HttpRouter.toWebHandler(
  Layer.merge(AppLive, Defect).pipe(
    Layer.provide([PersistenceMemory(), HttpServer.layerServices, TestAuthConfig, TestPatientCrypto]),
    // 요청을 처리하는 파이버가 쓰도록 출력 컨텍스트에 둡니다
    Layer.provideMerge(Layer.mergeAll(Logger.layer([captureLogs]), ErrorReporter.layer([captureReports]))),
  ),
  {
    disableLogger: true,
  },
)

afterAll(() => app.dispose())

function request(path: string): Promise<Response> {
  return app.handler(new Request(`http://localhost${path}`))
}

describe('AppLive', () => {
  it('serves the health check under /v1', async () => {
    const response = await request('/v1/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('renders unknown routes as problem details', async () => {
    const response = await request('/v1/missing')

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(await response.json()).toEqual({
      type: 'urn:hemr:problem:not-found',
      title: 'Resource not found',
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('renders defects as an internal problem without leaking the cause', async () => {
    const response = await request('/v1/defect')

    expect(response.status).toBe(500)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(await response.json()).toEqual({
      type: 'urn:hemr:problem:internal',
      title: 'Internal server error',
      status: 500,
      code: 'INTERNAL',
    })
  })

  it('예상 밖 오류의 원인을 오류 로그와 오류 보고자에 남깁니다', async () => {
    logged.length = 0
    reported.length = 0
    await request('/v1/defect')

    const boom = (cause: Cause.Cause<unknown>) => Cause.pretty(cause).includes('boom')
    expect(logged.filter((each) => each.level === 'Error' && boom(each.cause))).toHaveLength(1)
    expect(reported.filter(boom)).toHaveLength(1)
  })
})
