import { Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/http'
import { afterEach, describe, expect, it } from 'vitest'
import { AppLive } from '../../../app.ts'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { TestAuthConfig } from '../../identity/auth/auth-config.ts'
import { TEST_TENANT, testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'

const desk = testMember({ role: 'FRONT_DESK' })
const therapist = testMember({ role: 'THERAPIST' })
/** 접수는 하지만 진료 흐름을 옮기지 못하게 막은 데스크입니다. */
const checkInOnly = testMember({ role: 'FRONT_DESK', grants: [{ permission: 'visit:update', effect: 'REVOKE' }] })
const elsewhere = testMember({
  tenant: { ...TEST_TENANT, id: 'ten_01JBQ000000000000000000002' as typeof TEST_TENANT.id },
})

let dispose: (() => Promise<void>) | undefined
afterEach(() => dispose?.())

/** 세 구성원이 있는 새 앱입니다. 요청 사이에 저장소가 이어집니다. */
function app(store: 'memory' | 'sqlite' = 'memory') {
  const seeds = Layer.mergeAll(desk.seed, therapist.seed, checkInOnly.seed, elsewhere.seed).pipe(
    Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
  )
  const web = HttpRouter.toWebHandler(
    AppLive.pipe(Layer.provide([seeds, HttpServer.layerServices, TestAuthConfig, TestPatientCrypto])),
    { disableLogger: true },
  )
  dispose = web.dispose
  return (method: string, path: string, init: { body?: unknown; as?: typeof desk } = {}) => {
    const headers: Record<string, string> = { authorization: `Bearer ${(init.as ?? desk).token}` }
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

describe.each(['memory', 'sqlite'] as const)('visit check-in HTTP (%s)', (store) => {
  it('checks in, then reads the visit and lists the day by status', async () => {
    const send = app(store)
    const patient = await json(await send('POST', '/patients', { body: { name: '홍길동' } }))
    const checkedIn = await send('POST', '/visits:check-in', { body: { patientId: patient.id, coverage: 'SELF_PAY' } })
    const visit = await json(checkedIn)
    await send('POST', '/visits:check-in', {
      body: { patientId: patient.id, coverage: 'SELF_PAY', initialStatus: 'IN_TREATMENT' },
    })

    const read = await send('GET', `/visits/${visit.id}`)
    const today = await json(await send('GET', '/visits'))
    const waiting = await json(await send('GET', `/visits?date=${clinicDate(Date.now())}&status=WAITING`))
    const yesterday = await json(await send('GET', '/visits?date=2000-01-01'))
    const started = await send('POST', `/visits/${visit.id}:start-treatment`)

    expect(checkedIn.status).toBe(201)
    expect(checkedIn.headers.get('etag')).toBe('"1"')
    expect(visit).toMatchObject({ patientId: patient.id, status: 'WAITING', isFirstVisit: true })
    expect(read.headers.get('etag')).toBe('"1"')
    expect(await json(read)).toEqual(visit)
    expect((today['items'] as Body[]).map((each) => each['status'])).toEqual(['WAITING', 'IN_TREATMENT'])
    expect((waiting['items'] as Body[]).map((each) => each.id)).toEqual([visit.id])
    expect(yesterday['items']).toEqual([])
    expect(started.status).toBe(200)
  })

  it('answers a blocked check-in with 422 and every reason', async () => {
    const send = app(store)
    const patient = await json(await send('POST', '/patients', { body: { name: '홍길동' } }))
    const response = await send('POST', '/visits:check-in', { body: { patientId: patient.id, coverage: 'NHIS' } })

    expect(response.status).toBe(422)
    expect(await json(response)).toMatchObject({
      code: 'CHECK_IN_REJECTED',
      errors: ['NHIS_NOT_ELIGIBLE', 'IDENTITY_VERIFICATION_REQUIRED'],
    })
  })

  it('answers a repeated visit ID with 409', async () => {
    const send = app(store)
    const patient = await json(await send('POST', '/patients', { body: { name: '홍길동' } }))
    const body = { id: 'vis_01JBQ0000000000000000000AA', patientId: patient.id, coverage: 'SELF_PAY' }
    const first = await send('POST', '/visits:check-in', { body })
    const again = await send('POST', '/visits:check-in', { body })

    expect(first.status).toBe(201)
    expect(again.status).toBe(409)
    expect(await json(again)).toMatchObject({ code: 'VISIT_ALREADY_EXISTS' })
  })
})

describe('visit check-in HTTP', () => {
  it('rejects a malformed body with 400', async () => {
    const send = app()
    const response = await send('POST', '/visits:check-in', {
      body: { patientId: 'nope', coverage: 'CASH', eligibility: { qualificationCode: '1' } },
    })

    expect(response.status).toBe(400)
    expect(((await json(response))['violations'] as Body[]).map((each) => each['field'])).toEqual([
      'patientId',
      'coverage',
      'eligibility.selectedInstitutionCodes',
    ])
  })

  it('rejects fields it does not take yet instead of dropping them', async () => {
    const send = app()
    const patient = await json(await send('POST', '/patients', { body: { name: '홍길동' } }))
    const response = await send('POST', '/visits:check-in', {
      body: {
        patientId: patient.id,
        coverage: 'SELF_PAY',
        date: '2020-01-01',
        appointmentId: 'apt_01JBQ000000000000000000001',
        benefitFlags: { specialCaseCode: 'V123' },
      },
    })

    expect(response.status).toBe(400)
    expect(((await json(response))['violations'] as Body[]).map((each) => each['field'])).toEqual([
      'date',
      'appointmentId',
      'benefitFlags.specialCaseCode',
    ])
    expect((await json(await send('GET', '/visits')))['items']).toEqual([])
  })

  it('needs visit:update as well to start treatment at check-in', async () => {
    const send = app()
    const patient = await json(await send('POST', '/patients', { body: { name: '홍길동' } }))
    const body = { patientId: patient.id, coverage: 'SELF_PAY' }
    const straightIn = await send('POST', '/visits:check-in', {
      as: checkInOnly,
      body: { ...body, initialStatus: 'IN_TREATMENT' },
    })
    const waiting = await send('POST', '/visits:check-in', { as: checkInOnly, body })

    expect(straightIn.status).toBe(403)
    expect(await json(straightIn)).toMatchObject({ code: 'PERMISSION_DENIED', missing: ['visit:update'] })
    expect(waiting.status).toBe(201)
  })

  it('answers a visit ID taken by another tenant with the same 409', async () => {
    const send = app()
    const id = 'vis_01JBQ0000000000000000000AA'
    const own = await json(await send('POST', '/patients', { body: { name: '홍길동' } }))
    const theirs = await json(await send('POST', '/patients', { as: elsewhere, body: { name: '김' } }))
    await send('POST', '/visits:check-in', { body: { id, patientId: own.id, coverage: 'SELF_PAY' } })
    const taken = await send('POST', '/visits:check-in', {
      as: elsewhere,
      body: { id, patientId: theirs.id, coverage: 'SELF_PAY' },
    })

    expect(taken.status).toBe(409)
    expect(await json(taken)).toEqual(expect.not.objectContaining({ currentVersion: expect.anything() }))
    expect((await send('GET', `/visits/${id}`, { as: elsewhere })).status).toBe(404)
  })

  it('rejects a malformed list date with 400', async () => {
    const send = app()
    expect((await send('GET', '/visits?date=20261106')).status).toBe(400)
  })

  it('needs visit:check_in, which a therapist lacks', async () => {
    const send = app()
    const patient = await json(await send('POST', '/patients', { body: { name: '홍길동' } }))
    const response = await send('POST', '/visits:check-in', {
      as: therapist,
      body: { patientId: patient.id, coverage: 'SELF_PAY' },
    })

    expect(response.status).toBe(403)
    expect(await json(response)).toMatchObject({ code: 'PERMISSION_DENIED', missing: ['visit:check_in'] })
    expect((await send('GET', '/visits', { as: therapist })).status).toBe(200)
  })

  it('keeps patients and visits of another tenant out of reach', async () => {
    const send = app()
    const patient = await json(await send('POST', '/patients', { body: { name: '홍길동' } }))
    const visit = await json(
      await send('POST', '/visits:check-in', { body: { patientId: patient.id, coverage: 'SELF_PAY' } }),
    )

    const checkIn = await send('POST', '/visits:check-in', {
      as: elsewhere,
      body: { patientId: patient.id, coverage: 'SELF_PAY' },
    })
    const read = await send('GET', `/visits/${visit.id}`, { as: elsewhere })
    const list = await json(await send('GET', '/visits', { as: elsewhere }))

    expect(checkIn.status).toBe(404)
    expect(await json(checkIn)).toMatchObject({ code: 'PATIENT_NOT_FOUND' })
    expect(read.status).toBe(404)
    expect(list['items']).toEqual([])
  })
})
