import { Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/http'
import { afterEach, describe, expect, it } from 'vitest'
import { AppLive } from '../../../app.ts'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { TestAuthConfig } from '../../identity/auth/auth-config.ts'
import { TEST_TENANT, testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'

const manager = testMember({ role: 'MANAGER' })
const desk = testMember({ role: 'FRONT_DESK' })
/** 시재 권한이 없습니다. */
const therapist = testMember({ role: 'THERAPIST', licenseType: null })
const elsewhere = testMember({
  role: 'FRONT_DESK',
  tenant: { ...TEST_TENANT, id: 'ten_01JBQ000000000000000000002' as typeof TEST_TENANT.id },
})

let dispose: (() => Promise<void>) | undefined
afterEach(() => dispose?.())

interface Init {
  body?: unknown
  as?: typeof desk
  key?: string
}

function app(store: 'memory' | 'sqlite') {
  const seeds = Layer.mergeAll(manager.seed, desk.seed, therapist.seed, elsewhere.seed).pipe(
    Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
  )
  const web = HttpRouter.toWebHandler(
    AppLive.pipe(Layer.provide([seeds, HttpServer.layerServices, TestAuthConfig, TestPatientCrypto])),
    { disableLogger: true },
  )
  dispose = web.dispose
  return (method: string, path: string, init: Init = {}) => {
    const headers: Record<string, string> = { authorization: `Bearer ${(init.as ?? desk).token}` }
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    if (init.key !== undefined) headers['idempotency-key'] = init.key
    const request: RequestInit = { method, headers }
    if (init.body !== undefined) request.body = JSON.stringify(init.body)
    return web.handler(new Request(`http://localhost/v1${path}`, request))
  }
}

interface Body {
  id: string
  code: string
  [key: string]: unknown
}
const json = (response: Response) => response.json() as Promise<Body>

describe.each(['memory', 'sqlite'] as const)('cash drawer routes (%s)', (store) => {
  it('opens, records an expense, closes and keeps tenants apart', async () => {
    const send = app(store)
    const date = clinicDate(Date.now())
    const opened = await send('POST', `/cash-drawers/${date}:open`, { body: { openingAmount: 30_000 } })
    expect(opened.status).toBe(200)
    expect(await json(opened)).toMatchObject({ status: 'OPEN', openingAmount: 30_000 })

    const category = await send('POST', '/settings/expense-categories', { as: manager, body: { name: '비품' } })
    expect(category.status).toBe(201)
    const categoryId = (await json(category)).id

    const body = { date, amount: 5_000, categoryId }
    expect((await send('POST', '/expenses', { body })).status).toBe(400)
    const expense = await send('POST', '/expenses', { body, key: 'k1' })
    expect(expense.status).toBe(201)
    const expenseId = (await json(expense)).id
    expect((await json(await send('POST', '/expenses', { body, key: 'k1' }))).id).toBe(expenseId)
    expect(await json(await send('POST', '/expenses', { body: { ...body, amount: 6_000 }, key: 'k1' }))).toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    })

    const listed = await json(await send('GET', `/expenses?from=${date}&to=${date}`))
    expect(listed['items']).toHaveLength(1)
    const closed = await send('POST', `/cash-drawers/${date}:close`, { body: { countedAmount: 25_000 } })
    expect(await json(closed)).toMatchObject({ status: 'CLOSED', expectedClosing: 25_000 })
    expect((await send('DELETE', `/expenses/${expenseId}`)).status).toBe(409)

    // 다른 병원은 이 병원의 시재·지출을 보지 못합니다
    expect(await json(await send('GET', `/cash-drawers/${date}`, { as: elsewhere }))).toMatchObject({
      status: 'NOT_OPENED',
      expenses: 0,
    })
    expect((await send('DELETE', `/expenses/${expenseId}`, { as: elsewhere })).status).toBe(404)

    expect((await send('POST', `/cash-drawers/${date}:reopen`, { body: { reason: '지출 정정' } })).status).toBe(200)
    expect((await send('DELETE', `/expenses/${expenseId}`)).status).toBe(204)
  })

  it('checks permissions and request shapes', async () => {
    const send = app(store)
    const date = clinicDate(Date.now())
    expect((await send('GET', `/cash-drawers/${date}`, { as: therapist })).status).toBe(403)
    expect(
      (await send('POST', `/cash-drawers/${date}:open`, { as: therapist, body: { openingAmount: 0 } })).status,
    ).toBe(403)
    // 지출 항목은 설정이라 데스크는 읽기만 합니다
    expect((await send('POST', '/settings/expense-categories', { body: { name: '비품' } })).status).toBe(403)
    expect((await send('GET', '/settings/expense-categories')).status).toBe(200)
    expect(await send('GET', '/cash-drawers/2026-13')).toHaveProperty('status', 400)
    expect((await send('POST', `/cash-drawers/${date}:open`, { body: { openingAmount: -1 } })).status).toBe(400)
    expect((await send('POST', `/cash-drawers/${date}:open`, { body: { openingAmount: 0, extra: 1 } })).status).toBe(
      400,
    )
    expect((await send('GET', '/expenses?from=2026-01-01')).status).toBe(400)
    expect((await send('GET', '/expenses?from=2026-01-02&to=2026-01-01')).status).toBe(400)
    // 형식은 맞지만 달력에 없는 날짜입니다
    expect((await send('GET', '/cash-drawers/2026-13-01')).status).toBe(400)
    expect((await send('POST', '/cash-drawers/2026-02-30:open', { body: { openingAmount: 0 } })).status).toBe(400)
    expect((await send('GET', '/expenses?from=2026-02-29&to=2026-03-01')).status).toBe(400)
  })
})
