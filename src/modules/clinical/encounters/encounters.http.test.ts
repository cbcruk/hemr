import { Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/http'
import { afterEach, describe, expect, it } from 'vitest'
import { AppLive } from '../../../app.ts'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { TestAuthConfig } from '../../identity/auth/auth-config.ts'
import { TEST_TENANT, testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'

const doctor = testMember({ role: 'OWNER_DOCTOR' })
const desk = testMember({ role: 'FRONT_DESK' })
/** 원장 역할이지만 면허가 없어 진료기록을 쓰지 못합니다. */
const unlicensed = testMember({ role: 'OWNER_DOCTOR', licenseType: null })
const elsewhere = testMember({
  tenant: { ...TEST_TENANT, id: 'ten_01JBQ000000000000000000002' as typeof TEST_TENANT.id },
})

let dispose: (() => Promise<void>) | undefined
afterEach(() => dispose?.())

interface Init {
  body?: unknown
  as?: typeof desk
  ifMatch?: string
}

function app(store: 'memory' | 'sqlite' = 'memory') {
  const seeds = Layer.mergeAll(doctor.seed, desk.seed, unlicensed.seed, elsewhere.seed).pipe(
    Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
  )
  const web = HttpRouter.toWebHandler(
    AppLive.pipe(Layer.provide([seeds, HttpServer.layerServices, TestAuthConfig, TestPatientCrypto])),
    { disableLogger: true },
  )
  dispose = web.dispose
  return (method: string, path: string, init: Init = {}) => {
    const headers: Record<string, string> = { authorization: `Bearer ${(init.as ?? doctor).token}` }
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    if (init.ifMatch !== undefined) headers['if-match'] = init.ifMatch
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

/** 환자를 등록하고 접수해, 내원과 그 진료 ID를 돌려줍니다. */
async function checkedIn(send: ReturnType<typeof app>, as = desk) {
  const patient = await json(await send('POST', '/patients', { as, body: { name: '홍길동' } }))
  const visit = await json(
    await send('POST', '/visits:check-in', { as, body: { patientId: patient.id, coverage: 'SELF_PAY' } }),
  )
  return { patient, visit, encounterId: visit['encounterId'] as string }
}

describe.each(['memory', 'sqlite'] as const)('encounters HTTP (%s)', (store) => {
  it('creates an empty draft at check-in, then saves the note and diagnoses with If-Match', async () => {
    const send = app(store)
    const { patient, visit, encounterId } = await checkedIn(send)

    const draft = await send('GET', `/encounters/${encounterId}`, { as: desk })
    const saved = await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"1"',
      body: {
        note: { body: '<p>요통</p>' },
        diagnoses: {
          upsert: [
            { code: 'U23.4', kind: 'PRIMARY' },
            { code: 'M54.5', kind: 'PRIMARY' },
          ],
        },
      },
    })
    const body = await json(saved)
    const listed = await json(await send('GET', `/patients/${patient.id}/encounters`, { as: desk }))

    expect(encounterId).toMatch(/^enc_/)
    expect(draft.status).toBe(200)
    expect(draft.headers.get('etag')).toBe('"1"')
    expect(await json(draft)).toMatchObject({
      id: encounterId,
      visitId: visit.id,
      patientId: patient.id,
      doctorId: null,
      encounterType: 'OFFICE',
      coverage: 'SELF_PAY',
      serviceAt: visit['checkedInAt'],
      note: { body: '' },
      diagnoses: [],
      status: 'DRAFT',
      version: 1,
    })
    expect(saved.status).toBe(200)
    expect(saved.headers.get('etag')).toBe('"2"')
    expect(body['encounter']).toMatchObject({
      doctorId: doctor.user.id,
      note: { body: '<p>요통</p>' },
      diagnoses: [
        { id: expect.stringMatching(/^dx_/), code: 'U23.4', kind: 'PRIMARY' },
        { id: expect.stringMatching(/^dx_/), code: 'M54.5', kind: 'PRIMARY' },
      ],
      version: 2,
    })
    // 주상병이 둘이어도 저장하고 경고로 알립니다
    expect((body['warnings'] as Body[]).map((each) => each.code)).toEqual(['PRIMARY_DIAGNOSIS_MULTIPLE'])
    expect((listed['items'] as Body[]).map((each) => [each.id, each['version']])).toEqual([[encounterId, 2]])
  })

  it('refuses a stale version and keeps the newer save', async () => {
    const send = app(store)
    const { encounterId } = await checkedIn(send)
    await send('PATCH', `/encounters/${encounterId}`, { ifMatch: '"1"', body: { note: { body: '진료실' } } })
    const stale = await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"1"',
      body: { note: { body: '데스크' } },
    })

    expect(stale.status).toBe(412)
    expect(await json(stale)).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 2 })
    expect((await json(await send('GET', `/encounters/${encounterId}`)))['note']).toEqual({ body: '진료실' })
  })
})

describe('encounters HTTP (sqlite)', () => {
  it('lets only one of two concurrent saves of the same version win', async () => {
    const send = app('sqlite')
    const { encounterId } = await checkedIn(send)
    const responses = await Promise.all(
      ['진료실 1', '진료실 2'].map((body) =>
        send('PATCH', `/encounters/${encounterId}`, { ifMatch: '"1"', body: { note: { body } } }),
      ),
    )

    expect(responses.map((each) => each.status).sort()).toEqual([200, 412])
    expect((await json(await send('GET', `/encounters/${encounterId}`)))['version']).toBe(2)
  })
})

describe('encounters HTTP', () => {
  it('needs If-Match and rejects fields it does not take yet', async () => {
    const send = app()
    const { encounterId } = await checkedIn(send)
    const missing = await send('PATCH', `/encounters/${encounterId}`, { body: { note: { body: 'x' } } })
    const excess = await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"1"',
      body: { prescriptionLines: { upsert: [] }, diagnoses: { upsert: [{ code: 'u23', kind: 'PRIMARY' }] } },
    })

    expect(missing.status).toBe(400)
    expect(excess.status).toBe(400)
    expect(((await json(excess))['violations'] as Body[]).map((each) => each['field'])).toEqual([
      'prescriptionLines',
      'diagnoses.upsert[0].code',
    ])
    expect((await json(await send('GET', `/encounters/${encounterId}`)))['version']).toBe(1)
  })

  it('answers a change it cannot apply with 422, and a change with nothing new without a new version', async () => {
    const send = app()
    const { encounterId } = await checkedIn(send)
    const invalid = await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"1"',
      body: { diagnoses: { remove: ['dx_01JBQ000000000000000000009'] } },
    })
    const unchanged = await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"1"',
      body: { note: { body: '' } },
    })

    expect(invalid.status).toBe(422)
    expect(await json(invalid)).toMatchObject({
      code: 'ENCOUNTER_CHANGE_INVALID',
      errors: [{ reason: 'DIAGNOSIS_NOT_FOUND', target: 'dx_01JBQ000000000000000000009' }],
    })
    expect(unchanged.status).toBe(200)
    expect(unchanged.headers.get('etag')).toBe('"1"')
    expect((await json(unchanged))['encounter']).toMatchObject({ doctorId: null, version: 1 })
  })

  it('lets the desk read but only a licensed user write', async () => {
    const send = app()
    const { encounterId } = await checkedIn(send)
    const byDesk = await send('PATCH', `/encounters/${encounterId}`, { as: desk, ifMatch: '"1"', body: {} })
    const byUnlicensed = await send('PATCH', `/encounters/${encounterId}`, { as: unlicensed, ifMatch: '"1"', body: {} })

    expect(byDesk.status).toBe(403)
    expect(await json(byDesk)).toMatchObject({ code: 'PERMISSION_DENIED', missing: ['encounter:write'] })
    expect(byUnlicensed.status).toBe(403)
    expect((await send('GET', `/encounters/${encounterId}`, { as: desk })).status).toBe(200)
  })

  it('keeps encounters of another tenant out of reach', async () => {
    const send = app()
    const { patient, encounterId } = await checkedIn(send)
    const read = await send('GET', `/encounters/${encounterId}`, { as: elsewhere })
    const write = await send('PATCH', `/encounters/${encounterId}`, {
      as: elsewhere,
      ifMatch: '"1"',
      body: { note: { body: 'x' } },
    })
    const list = await send('GET', `/patients/${patient.id}/encounters`, { as: elsewhere })

    expect(read.status).toBe(404)
    expect(await json(read)).toMatchObject({ code: 'ENCOUNTER_NOT_FOUND' })
    expect(write.status).toBe(404)
    expect(list.status).toBe(404)
    expect(await json(list)).toMatchObject({ code: 'PATIENT_NOT_FOUND' })
  })

  it('counts a charted encounter as clinical data when canceling the visit', async () => {
    const send = app()
    const empty = await checkedIn(send)
    const charted = await checkedIn(send)
    await send('PATCH', `/encounters/${charted.encounterId}`, {
      ifMatch: '"1"',
      body: { diagnoses: { upsert: [{ code: 'U23.4', kind: 'PRIMARY' }] } },
    })

    const cancelEmpty = await send('POST', `/visits/${empty.visit.id}:cancel`, { as: desk, body: { reason: '취소' } })
    const cancelCharted = await send('POST', `/visits/${charted.visit.id}:cancel`, {
      as: desk,
      body: { reason: '취소' },
    })

    expect(cancelEmpty.status).toBe(200)
    expect(cancelCharted.status).toBe(409)
    expect(await json(cancelCharted)).toMatchObject({ code: 'VISIT_HAS_CLINICAL_DATA' })
  })

  it('treats an emptied editor note as no content and refuses to chart on a canceled visit', async () => {
    const send = app()
    const { visit, encounterId } = await checkedIn(send)
    await send('PATCH', `/encounters/${encounterId}`, { ifMatch: '"1"', body: { note: { body: '<p><br></p>' } } })
    const canceled = await send('POST', `/visits/${visit.id}:cancel`, { as: desk, body: { reason: '취소' } })
    const late = await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"2"',
      body: { note: { body: '<p>요통</p>' } },
    })

    expect(canceled.status).toBe(200)
    expect(late.status).toBe(409)
    expect(await json(late)).toMatchObject({ code: 'ENCOUNTER_VISIT_CANCELED' })
  })
})
