import { Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/http'
import { describe, expect, it } from 'vitest'
import { AppLive } from '../../../app.ts'
import type { Visit } from './visit.ts'
import { VisitRepository } from './visit-repository.ts'

const VISIT_ID = 'vis_01JBQ000000000000000000001'

function visit(status: Visit['status']): Visit {
  return {
    id: VISIT_ID as Visit['id'],
    patientId: 'pat_01JBQ000000000000000000001' as Visit['patientId'],
    date: '2026-11-05',
    status,
    statusChangedAt: '2026-11-05T00:00:00.000Z',
  }
}

/** 저장소에 `seed`만 있는 새 앱에 커맨드 하나를 보냅니다. */
async function send(seed: Visit[], path: string, body?: unknown): Promise<Response> {
  const app = HttpRouter.toWebHandler(
    AppLive.pipe(Layer.provide([VisitRepository.layerMemory(seed), HttpServer.layerServices])),
    { disableLogger: true },
  )
  try {
    const init: RequestInit =
      body === undefined
        ? { method: 'POST' }
        : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    return await app.handler(new Request(`http://localhost/v1/visits/${path}`, init))
  } finally {
    await app.dispose()
  }
}

describe('POST /v1/visits/{id}:{command}', () => {
  it('starts treatment for a waiting visit', async () => {
    const response = await send([visit('WAITING')], `${VISIT_ID}:start-treatment`)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: VISIT_ID, status: 'IN_TREATMENT' })
  })

  it.each([
    ['IN_TREATMENT', 'return-to-waiting', 'WAITING'],
    ['IN_TREATMENT', 'send-to-checkout', 'AWAITING_PAYMENT'],
  ] as const)('moves %s with :%s to %s', async (from, command, to) => {
    const response = await send([visit(from)], `${VISIT_ID}:${command}`)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: to })
  })

  it('reopens a completed visit and keeps the reason', async () => {
    const response = await send([visit('COMPLETED')], `${VISIT_ID}:reopen`, { reason: '금액 정정' })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'AWAITING_PAYMENT', statusReason: '금액 정정' })
  })

  it('refuses a command the current status does not allow', async () => {
    const response = await send([visit('COMPLETED')], `${VISIT_ID}:start-treatment`)

    expect(response.status).toBe(409)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(await response.json()).toEqual({
      type: 'urn:hemr:problem:visit-transition-invalid',
      title: 'Visit status does not allow this command',
      status: 409,
      code: 'VISIT_TRANSITION_INVALID',
      currentStatus: 'COMPLETED',
      command: 'START_TREATMENT',
    })
  })

  it('refuses to cancel a visit in treatment without cascade', async () => {
    const response = await send([visit('IN_TREATMENT')], `${VISIT_ID}:cancel`, { reason: '환자 요청' })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      type: 'urn:hemr:problem:visit-has-clinical-data',
      title: 'Visit has clinical data',
      status: 409,
      code: 'VISIT_HAS_CLINICAL_DATA',
      currentStatus: 'IN_TREATMENT',
    })
  })

  it('cancels a visit in treatment with cascade', async () => {
    const response = await send([visit('IN_TREATMENT')], `${VISIT_ID}:cancel`, { reason: '환자 요청', cascade: true })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'CANCELED', statusReason: '환자 요청' })
  })

  it('answers 404 for an unknown visit', async () => {
    const response = await send([], `${VISIT_ID}:start-treatment`)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      type: 'urn:hemr:problem:visit-not-found',
      title: 'Visit not found',
      status: 404,
      code: 'VISIT_NOT_FOUND',
    })
  })

  it('rejects a cancel without a reason', async () => {
    const response = await send([visit('WAITING')], `${VISIT_ID}:cancel`, {})

    expect(response.status).toBe(400)
  })

  it('rejects an id that is not a visit id', async () => {
    const response = await send([visit('WAITING')], 'pat_01JBQ000000000000000000001:start-treatment')

    expect(response.status).toBe(400)
  })
})
