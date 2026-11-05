import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/http'
import { describe, expect, it } from 'vitest'
import { AppLive } from '../../../app.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import type { Visit } from './visit.ts'
import { VisitRepository } from './visit-repository.ts'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'

const VISIT_ID = 'vis_01JBQ000000000000000000001'
const PAST_DATE = '2000-01-01'

function visit(status: Visit['status'], overrides: Partial<Visit> = {}): Visit {
  return {
    id: VISIT_ID as Visit['id'],
    patientId: 'pat_01JBQ000000000000000000001' as Visit['patientId'],
    date: clinicDate(Date.now()),
    status,
    statusChangedAt: '2026-11-05T00:00:00.000Z',
    hasClinicalData: false,
    version: 1,
    ...overrides,
  }
}

interface SendOptions {
  body?: unknown
  ifMatch?: string
  /** 저장소 구현입니다. 기본은 메모리입니다. */
  store?: 'memory' | 'sqlite'
}

/** 빈 인메모리 SQLite에 `seed`를 넣은 저장소입니다. */
const sqliteWith = (seed: Visit[]) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const repository = yield* VisitRepository
      yield* Effect.forEach(seed, (each) => repository.save(each, { expectedVersion: null }))
    }),
  ).pipe(Layer.provideMerge(PersistenceSqlite(':memory:')))

/** 저장소에 `seed`만 있는 새 앱에 커맨드 하나를 보냅니다. */
async function send(seed: Visit[], path: string, options: SendOptions = {}): Promise<Response> {
  const app = HttpRouter.toWebHandler(
    AppLive.pipe(
      Layer.provide([
        options.store === 'sqlite' ? sqliteWith(seed) : PersistenceMemory(seed),
        HttpServer.layerServices,
      ]),
    ),
    { disableLogger: true },
  )
  try {
    const headers: Record<string, string> = {}
    if (options.body !== undefined) headers['content-type'] = 'application/json'
    if (options.ifMatch !== undefined) headers['if-match'] = options.ifMatch
    const init: RequestInit = { method: 'POST', headers }
    if (options.body !== undefined) init.body = JSON.stringify(options.body)
    return await app.handler(new Request(`http://localhost/v1/visits/${path}`, init))
  } finally {
    await app.dispose()
  }
}

describe('POST /v1/visits/{id}:{command}', () => {
  it('starts treatment for a waiting visit and bumps the version', async () => {
    const response = await send([visit('WAITING')], `${VISIT_ID}:start-treatment`)

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"2"')
    expect(await response.json()).toMatchObject({ id: VISIT_ID, status: 'IN_TREATMENT', version: 2 })
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
    const response = await send([visit('COMPLETED')], `${VISIT_ID}:reopen`, { body: { reason: '금액 정정' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'AWAITING_PAYMENT', statusReason: '금액 정정' })
  })

  it('reopens and moves on in one call with then', async () => {
    const response = await send([visit('COMPLETED')], `${VISIT_ID}:reopen`, {
      body: { reason: '추가 치료', then: 'IN_TREATMENT' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'IN_TREATMENT', version: 2 })
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

  describe('cancel', () => {
    it('cancels a visit in treatment that has no clinical data', async () => {
      const response = await send([visit('IN_TREATMENT')], `${VISIT_ID}:cancel`, { body: { reason: '환자 요청' } })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ status: 'CANCELED', statusReason: '환자 요청' })
    })

    it('refuses to cancel a visit with clinical data without cascade, whatever the status', async () => {
      const response = await send([visit('AWAITING_PAYMENT', { hasClinicalData: true })], `${VISIT_ID}:cancel`, {
        body: { reason: '환자 요청' },
      })

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        type: 'urn:hemr:problem:visit-has-clinical-data',
        title: 'Visit has clinical data',
        status: 409,
        code: 'VISIT_HAS_CLINICAL_DATA',
        currentStatus: 'AWAITING_PAYMENT',
      })
    })

    it('cancels a visit with clinical data when cascade is set', async () => {
      const response = await send([visit('IN_TREATMENT', { hasClinicalData: true })], `${VISIT_ID}:cancel`, {
        body: { reason: '환자 요청', cascade: true },
      })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ status: 'CANCELED' })
    })
  })

  describe('past date', () => {
    it('refuses a flow command on a past visit', async () => {
      const response = await send([visit('AWAITING_PAYMENT', { date: PAST_DATE })], `${VISIT_ID}:start-treatment`)

      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({
        type: 'urn:hemr:problem:visit-date-past',
        title: 'Visit date has passed',
        status: 422,
        code: 'VISIT_DATE_PAST',
        date: PAST_DATE,
      })
    })

    it('still cancels a past visit', async () => {
      const response = await send([visit('AWAITING_PAYMENT', { date: PAST_DATE })], `${VISIT_ID}:cancel`, {
        body: { reason: '전날 미정리' },
      })

      expect(response.status).toBe(200)
    })

    it('refuses reopen with then on a past visit', async () => {
      const response = await send([visit('COMPLETED', { date: PAST_DATE })], `${VISIT_ID}:reopen`, {
        body: { reason: '추가 치료', then: 'WAITING' },
      })

      expect(response.status).toBe(422)
    })
  })

  describe('If-Match', () => {
    it('accepts the current version', async () => {
      const response = await send([visit('WAITING', { version: 7 })], `${VISIT_ID}:start-treatment`, { ifMatch: '"7"' })

      expect(response.status).toBe(200)
      expect(response.headers.get('etag')).toBe('"8"')
    })

    it('answers 412 when someone changed the visit first', async () => {
      const response = await send([visit('WAITING', { version: 7 })], `${VISIT_ID}:start-treatment`, { ifMatch: '"6"' })

      expect(response.status).toBe(412)
      expect(await response.json()).toEqual({
        type: 'urn:hemr:problem:version-mismatch',
        title: 'Resource was changed by someone else',
        status: 412,
        code: 'VERSION_MISMATCH',
        currentVersion: 7,
      })
    })

    it('treats a malformed version as a mismatch', async () => {
      const response = await send([visit('WAITING')], `${VISIT_ID}:start-treatment`, { ifMatch: 'abc' })

      expect(response.status).toBe(412)
    })
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

  it('reports every invalid field of a cancel at once', async () => {
    const response = await send([visit('WAITING')], `${VISIT_ID}:cancel`, { body: { reason: '', cascade: 'yes' } })

    expect(response.status).toBe(400)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(await response.json()).toEqual({
      type: 'urn:hemr:problem:validation-failed',
      title: 'Request validation failed',
      status: 400,
      code: 'VALIDATION_FAILED',
      violations: [
        { field: 'reason', code: 'INVALID_VALUE' },
        { field: 'cascade', code: 'INVALID_TYPE' },
      ],
    })
  })

  it('rejects a cancel without a reason', async () => {
    const response = await send([visit('WAITING')], `${VISIT_ID}:cancel`, { body: {} })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ violations: [{ field: 'reason', code: 'REQUIRED' }] })
  })

  it('rejects an id that is not a visit id', async () => {
    const response = await send([visit('WAITING')], 'pat_01JBQ000000000000000000001:start-treatment')

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ violations: [{ field: 'id', code: 'INVALID_VALUE' }] })
  })

  describe('on SQLite', () => {
    it('stores the transition and answers 412 for a stale If-Match', async () => {
      const ok = await send([visit('WAITING')], `${VISIT_ID}:start-treatment`, { store: 'sqlite' })
      expect(ok.status).toBe(200)
      expect(await ok.json()).toMatchObject({ status: 'IN_TREATMENT', version: 2 })

      const stale = await send([visit('WAITING', { version: 3 })], `${VISIT_ID}:start-treatment`, {
        store: 'sqlite',
        ifMatch: '"2"',
      })
      expect(stale.status).toBe(412)
      expect(await stale.json()).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 3 })
    })
  })
})
