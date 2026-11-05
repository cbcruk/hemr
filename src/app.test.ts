import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/http'
import { afterAll, describe, expect, it } from 'vitest'
import { AppLive } from './app.ts'
import { VisitRepository } from './modules/front-desk/visits/visit-repository.ts'

const Defect = HttpRouter.add('GET', '/v1/defect', Effect.die(new Error('boom')))

const app = HttpRouter.toWebHandler(
  Layer.merge(AppLive, Defect).pipe(Layer.provide([VisitRepository.layerMemory(), HttpServer.layerServices])),
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
})
