import { Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/http'
import { afterEach, describe, expect, it } from 'vitest'
import { AppLive } from '../../app.ts'
import { PersistenceMemory } from '../../persistence.ts'
import { TestAuthConfig } from '../identity/auth/auth-config.ts'
import { TEST_TENANT, testMember } from '../identity/auth/testing.ts'
import { TestPatientCrypto } from './patient-crypto.ts'

const desk = testMember({ role: 'FRONT_DESK' })
const therapist = testMember({ role: 'THERAPIST' })
const elsewhere = testMember({
  tenant: { ...TEST_TENANT, id: 'ten_01JBQ000000000000000000002' as typeof TEST_TENANT.id },
})

let dispose: (() => Promise<void>) | undefined
afterEach(() => dispose?.())

/** 세 구성원이 있는 새 앱입니다. 요청 사이에 저장소가 이어집니다. */
function app() {
  const seeds = Layer.mergeAll(desk.seed, therapist.seed, elsewhere.seed).pipe(Layer.provideMerge(PersistenceMemory()))
  const web = HttpRouter.toWebHandler(
    AppLive.pipe(Layer.provide([seeds, HttpServer.layerServices, TestAuthConfig, TestPatientCrypto])),
    { disableLogger: true },
  )
  dispose = web.dispose
  return (
    method: string,
    path: string,
    init: { body?: unknown; as?: typeof desk; headers?: Record<string, string> } = {},
  ) => {
    const headers: Record<string, string> = { authorization: `Bearer ${(init.as ?? desk).token}`, ...init.headers }
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

describe('patients HTTP', () => {
  it('registers a patient with a masked RRN and an ETag', async () => {
    const send = app()
    const response = await send('POST', '/patients', {
      body: {
        name: '홍길동',
        rrn: '900101-1234567',
        contacts: [{ kind: 'MOBILE', number: '010-1234-5678', isPrimary: true }],
      },
    })
    const body = await json(response)

    expect(response.status).toBe(201)
    expect(response.headers.get('etag')).toBe('"1"')
    expect(body).toMatchObject({ chartNumber: '1', rrnMasked: '900101-1******', birthDate: '1990-01-01', sex: 'MALE' })
    expect(Object.keys(body)).not.toContain('rrn')
    expect(JSON.stringify(body)).not.toContain('1234567')
  })

  it('answers a duplicate RRN with the existing patient and a taken chart number with 409', async () => {
    const send = app()
    const first = await json(
      await send('POST', '/patients', { body: { name: '홍길동', rrn: '9001011234567', chartNumber: '10' } }),
    )
    const rrn = await send('POST', '/patients', { body: { name: '홍길동', rrn: '900101-1234567' } })
    const chart = await send('POST', '/patients', { body: { name: '김', chartNumber: '10' } })

    expect(rrn.status).toBe(409)
    expect(await json(rrn)).toMatchObject({ code: 'PATIENT_DUPLICATE_RRN', patientId: first.id })
    expect(chart.status).toBe(409)
    expect(await json(chart)).toMatchObject({ code: 'CHART_NUMBER_TAKEN', chartNumber: '10' })
  })

  it('rejects an invalid registration with every violation', async () => {
    const send = app()
    const response = await send('POST', '/patients', { body: { name: ' ', rrn: '900231-1234567', chartNumber: '1 2' } })

    expect(response.status).toBe(400)
    expect((await json(response))['violations']).toEqual([
      { field: 'name', code: 'INVALID_VALUE' },
      { field: 'chartNumber', code: 'INVALID_VALUE' },
      { field: 'rrn', code: 'INVALID_VALUE' },
    ])
  })

  it('searches, reads and updates with If-Match', async () => {
    const send = app()
    const { id } = await json(await send('POST', '/patients', { body: { name: '홍길동' } }))
    await send('POST', '/patients', { body: { name: '김철수' } })

    const search = await json(await send('GET', `/patients?q=${encodeURIComponent('ㅎㄱ')}`))
    const next = await json(await send('GET', '/patients:next-chart-number'))
    const updated = await send('PATCH', `/patients/${id}`, {
      body: { notes: '허리 통증' },
      headers: { 'if-match': '"1"' },
    })
    const stale = await send('PATCH', `/patients/${id}`, { body: { notes: '다시' }, headers: { 'if-match': '"1"' } })
    const read = await send('GET', `/patients/${id}`)

    expect((search['items'] as Body[]).map((each) => each['name'])).toEqual(['홍길동'])
    expect(next).toEqual({ chartNumber: '3' })
    expect(updated.status).toBe(200)
    expect(updated.headers.get('etag')).toBe('"2"')
    expect(stale.status).toBe(412)
    expect(await json(read)).toMatchObject({ notes: '허리 통증', version: 2 })
  })

  it('caps numeric chart numbers at 12 digits so automatic numbering cannot get stuck', async () => {
    const send = app()
    const long = await send('POST', '/patients', { body: { name: '홍길동', chartNumber: '1234567890123' } })
    const max = await send('POST', '/patients', { body: { name: '홍길동', chartNumber: '999999999999' } })
    const auto = await json(await send('POST', '/patients', { body: { name: '김' } }))

    expect(long.status).toBe(400)
    expect(max.status).toBe(201)
    expect(auto['chartNumber']).toBe('1000000000000')
    expect((await send('POST', '/patients', { body: { name: '이' } })).status).toBe(201)
  })

  it('rejects a limit outside 1–200', async () => {
    const send = app()
    expect((await send('GET', '/patients?limit=0')).status).toBe(400)
    expect((await send('GET', '/patients?limit=201')).status).toBe(400)
    expect((await send('GET', '/patients?limit=200')).status).toBe(200)
  })

  it('reveals the RRN only with a reason and the permission for it', async () => {
    const send = app()
    const { id } = await json(await send('POST', '/patients', { body: { name: '홍길동', rrn: '9001011234567' } }))
    const reason = { 'x-access-reason': encodeURIComponent('보험 자격 조회') }

    const missing = await send('GET', `/patients/${id}/rrn`)
    const malformed = await send('GET', `/patients/${id}/rrn`, { headers: { 'x-access-reason': '%E0%A4%A' } })
    const blank = await send('GET', `/patients/${id}/rrn`, { headers: { 'x-access-reason': '%20' } })
    const denied = await send('GET', `/patients/${id}/rrn`, { as: therapist, headers: reason })
    const ok = await send('GET', `/patients/${id}/rrn`, { headers: reason })

    expect([missing.status, malformed.status, blank.status]).toEqual([400, 400, 400])
    expect(denied.status).toBe(403)
    expect(await json(denied)).toMatchObject({ code: 'PERMISSION_DENIED', missing: ['patient.rrn:read'] })
    expect(await json(ok)).toEqual({ rrn: '900101-1234567' })
  })

  it('keeps patients of another tenant out of reach', async () => {
    const send = app()
    const { id } = await json(await send('POST', '/patients', { body: { name: '홍길동' } }))

    const read = await send('GET', `/patients/${id}`, { as: elsewhere })
    const list = await json(await send('GET', '/patients', { as: elsewhere }))
    const update = await send('PATCH', `/patients/${id}`, { as: elsewhere, body: { name: '김' } })

    expect(read.status).toBe(404)
    expect(list['items']).toEqual([])
    expect(update.status).toBe(404)
  })

  it('lets a therapist read patients but not register them', async () => {
    const send = app()
    const created = await send('POST', '/patients', { as: therapist, body: { name: '홍길동' } })
    const list = await send('GET', '/patients', { as: therapist })

    expect(created.status).toBe(403)
    expect(await json(created)).toMatchObject({ missing: ['patient:create'] })
    expect(list.status).toBe(200)
  })

  it('records consents as the desk and refuses a claimed patient source', async () => {
    const send = app()
    const { id } = await json(await send('POST', '/patients', { body: { name: '홍길동' } }))

    const recorded = await send('POST', `/patients/${id}/consents`, {
      body: { purpose: 'MARKETING_SMS', status: 'GRANTED' },
    })
    const fromOutside = await send('POST', `/patients/${id}/consents`, {
      body: { purpose: 'MARKETING_SMS', status: 'GRANTED', source: 'TABLET' },
    })
    const unknownPurpose = await send('POST', `/patients/${id}/consents`, {
      body: { purpose: 'SPAM', status: 'GRANTED' },
    })
    const current = await send('GET', `/patients/${id}/consents`)
    const history = await send('GET', `/patients/${id}/consents/history`)

    expect(recorded.status).toBe(201)
    expect(await json(recorded)).toMatchObject({ purpose: 'MARKETING_SMS', status: 'GRANTED', decidedBy: desk.user.id })
    // 본문의 출처는 무시하고 늘 데스크 기록으로 남깁니다. 직원이 환자 본인의 동의를 꾸밀 수 없습니다
    expect(fromOutside.status).toBe(201)
    expect(await json(fromOutside)).toMatchObject({ source: 'DESK' })
    expect(unknownPurpose.status).toBe(400)
    expect(await current.json()).toEqual([expect.objectContaining({ purpose: 'MARKETING_SMS', status: 'GRANTED' })])
    expect(await history.json()).toHaveLength(2)
  })
})
