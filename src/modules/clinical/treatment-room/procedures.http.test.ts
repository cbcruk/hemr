import { Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/http'
import { afterEach, describe, expect, it } from 'vitest'
import { AppLive } from '../../../app.ts'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { TestAuthConfig } from '../../identity/auth/auth-config.ts'
import { TEST_TENANT, testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'

const doctor = testMember({ role: 'OWNER_DOCTOR' })
/** 시술은 보지만 바꾸지 못합니다. */
const desk = testMember({ role: 'FRONT_DESK' })
/** 면허 없이 시술을 진행합니다. */
const therapist = testMember({ role: 'THERAPIST', licenseType: null })
/** 시술은 보지만 내원은 보지 못합니다. */
const noVisits = testMember({
  role: 'THERAPIST',
  licenseType: null,
  grants: [{ permission: 'visit:read', effect: 'REVOKE' }],
})
const elsewhere = testMember({
  tenant: { ...TEST_TENANT, id: 'ten_01JBQ000000000000000000002' as typeof TEST_TENANT.id },
})

let dispose: (() => Promise<void>) | undefined
afterEach(() => dispose?.())

interface Init {
  body?: unknown
  as?: typeof desk
}

function app(store: 'memory' | 'sqlite') {
  const seeds = Layer.mergeAll(doctor.seed, desk.seed, therapist.seed, noVisits.seed, elsewhere.seed).pipe(
    Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
  )
  const web = HttpRouter.toWebHandler(
    AppLive.pipe(Layer.provide([seeds, HttpServer.layerServices, TestAuthConfig, TestPatientCrypto])),
    { disableLogger: true },
  )
  dispose = web.dispose
  return (method: string, path: string, init: Init = {}) => {
    const headers: Record<string, string> = { authorization: `Bearer ${(init.as ?? therapist).token}` }
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    const request: RequestInit = { method, headers }
    if (init.body !== undefined) request.body = JSON.stringify(init.body)
    return web.handler(new Request(`http://localhost/v1${path}`, request))
  }
}

/** 응답 본문입니다. 시험에서 보는 필드만 적습니다. */
interface Body {
  id: string
  code: string
  [key: string]: unknown
}
const json = (response: Response) => response.json() as Promise<Body>
const itemsOf = async (response: Response) => (await json(response))['items'] as Body[]

/** 환자를 등록하고 접수해 내원을 돌려줍니다. */
async function checkedIn(send: ReturnType<typeof app>) {
  const patient = await json(await send('POST', '/patients', { as: desk, body: { name: '홍길동' } }))
  return json(
    await send('POST', '/visits:check-in', { as: desk, body: { patientId: patient.id, coverage: 'SELF_PAY' } }),
  )
}

describe.each(['memory', 'sqlite'] as const)('procedures HTTP (%s)', (store) => {
  it('adds, starts, completes and lists procedures on the board with the server time', async () => {
    const send = app(store)
    const visit = await checkedIn(send)
    const added = await send('POST', `/visits/${visit.id}/procedures`, { body: { name: '침', durationSeconds: 600 } })
    const procedure = await json(added)
    await send('POST', `/visits/${visit.id}/procedures`, { body: { name: '부항' } })

    const started = await send('POST', `/procedures/${procedure.id}:start`)
    const again = await send('POST', `/procedures/${procedure.id}:start`)
    const completed = await send('POST', `/procedures/${procedure.id}:complete`)
    const board = await json(await send('GET', '/treatment-rooms/board', { as: desk }))

    expect(added.status).toBe(201)
    expect(procedure).toMatchObject({ id: expect.stringMatching(/^prc_/), status: 'PENDING', order: 0 })
    expect(started.status).toBe(200)
    expect((await itemsOf(started)).map((each) => [each.id, each['status']])).toEqual([[procedure.id, 'RUNNING']])
    expect(again.status).toBe(409)
    expect(await json(again)).toMatchObject({ code: 'PROCEDURE_TRANSITION_INVALID', currentStatus: 'RUNNING' })
    expect(await json(completed)).toMatchObject({ status: 'DONE', version: 3 })
    expect(typeof board['serverTime']).toBe('string')
    const entries = board['items'] as { visit: Body; procedures: Body[] }[]
    expect(entries.map((each) => [each.visit.id, each.procedures.map((p) => p['status'])])).toEqual([
      [visit.id, ['DONE', 'PENDING']],
    ])
  })

  it('runs visit-wide commands, reorders and removes', async () => {
    const send = app(store)
    const visit = await checkedIn(send)
    const a = await json(await send('POST', `/visits/${visit.id}/procedures`, { body: { name: 'A' } }))
    const b = await json(await send('POST', `/visits/${visit.id}/procedures`, { body: { name: 'B' } }))

    const reordered = await send('PUT', `/visits/${visit.id}/procedures:reorder`, { body: { ids: [b.id, a.id] } })
    const partial = await send('PUT', `/visits/${visit.id}/procedures:reorder`, { body: { ids: [b.id] } })
    const startAll = await send('POST', `/visits/${visit.id}/procedures:start-all`)
    const removeRunning = await send('DELETE', `/procedures/${a.id}`)
    const completeAll = await send('POST', `/visits/${visit.id}/procedures:complete-all`)
    const reopened = await send('POST', `/procedures/${a.id}:reopen`)
    const removed = await send('DELETE', `/procedures/${a.id}`)
    const listed = await itemsOf(await send('GET', `/visits/${visit.id}/procedures`, { as: desk }))

    expect((await itemsOf(reordered)).map((each) => each['name'])).toEqual(['B', 'A'])
    expect(partial.status).toBe(422)
    expect(await json(partial)).toMatchObject({ code: 'PROCEDURE_ORDER_INVALID' })
    expect((await itemsOf(startAll)).map((each) => each['status'])).toEqual(['RUNNING', 'RUNNING'])
    expect(removeRunning.status).toBe(409)
    expect((await itemsOf(completeAll)).map((each) => each['status'])).toEqual(['DONE', 'DONE'])
    expect(reopened.status).toBe(200)
    expect(removed.status).toBe(204)
    expect(listed.map((each) => each['name'])).toEqual(['B'])
  })

  it('changes duration and restarts the timer', async () => {
    const send = app(store)
    const visit = await checkedIn(send)
    const p = await json(await send('POST', `/visits/${visit.id}/procedures`, { body: { name: '침' } }))
    const pending = await json(await send('PATCH', `/procedures/${p.id}`, { body: { durationSeconds: 900 } }))
    const restartPending = await send('POST', `/procedures/${p.id}:restart-timer`)
    await send('POST', `/procedures/${p.id}:start`)
    const restarted = await send('POST', `/procedures/${p.id}:restart-timer`)
    await send('POST', `/procedures/${p.id}:complete`)
    const done = await send('PATCH', `/procedures/${p.id}`, { body: { durationSeconds: 60 } })

    expect(pending).toMatchObject({ durationSeconds: 900, status: 'PENDING' })
    expect(restartPending.status).toBe(409)
    expect(await json(restarted)).toMatchObject({ status: 'RUNNING', durationSeconds: 900 })
    expect(done.status).toBe(409)
    expect(await json(done)).toMatchObject({ code: 'PROCEDURE_TRANSITION_INVALID', currentStatus: 'DONE' })
  })

  it('checks permissions, payloads, tenants and closed visits', async () => {
    const send = app(store)
    const visit = await checkedIn(send)
    const p = await json(await send('POST', `/visits/${visit.id}/procedures`, { as: doctor, body: { name: '침' } }))

    const deskAdd = await send('POST', `/visits/${visit.id}/procedures`, { as: desk, body: { name: '침' } })
    const deskStart = await send('POST', `/procedures/${p.id}:start`, { as: desk })
    const extra = await send('POST', `/visits/${visit.id}/procedures`, { body: { name: '침', color: 'red' } })
    const blank = await send('POST', `/visits/${visit.id}/procedures`, { body: { name: '   ' } })
    const boardWithoutVisits = await send('GET', '/treatment-rooms/board', { as: noVisits })
    const listWithoutVisits = await send('GET', `/visits/${visit.id}/procedures`, { as: noVisits })
    const zero = await send('PATCH', `/procedures/${p.id}`, { body: { durationSeconds: 0 } })
    const foreignVisit = await send('GET', `/visits/${visit.id}/procedures`, { as: elsewhere })
    const foreignProcedure = await send('POST', `/procedures/${p.id}:start`, { as: elsewhere })
    await send('POST', `/visits/${visit.id}:cancel`, { as: desk, body: { reason: '중복 접수' } })
    const closed = await send('POST', `/visits/${visit.id}/procedures`, { body: { name: '부항' } })
    const startClosed = await send('POST', `/procedures/${p.id}:start`)

    expect(p['status']).toBe('PENDING')
    expect(deskAdd.status).toBe(403)
    expect(deskStart.status).toBe(403)
    expect(extra.status).toBe(400)
    expect(zero.status).toBe(400)
    expect(blank.status).toBe(400)
    expect(boardWithoutVisits.status).toBe(403)
    expect(listWithoutVisits.status).toBe(200)
    expect(foreignVisit.status).toBe(404)
    expect(await json(foreignVisit)).toMatchObject({ code: 'VISIT_NOT_FOUND' })
    expect(foreignProcedure.status).toBe(404)
    expect(await json(foreignProcedure)).toMatchObject({ code: 'PROCEDURE_NOT_FOUND' })
    expect(closed.status).toBe(409)
    expect(await json(closed)).toMatchObject({ code: 'PROCEDURE_VISIT_CLOSED' })
    expect(startClosed.status).toBe(409)
  })
})
