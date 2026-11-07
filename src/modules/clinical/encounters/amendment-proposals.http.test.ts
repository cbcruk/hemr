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
/** 제안을 만들 권한이 없습니다. */
const therapist = testMember({ role: 'THERAPIST', licenseType: null })
/** 진료기록은 정정하지만 처방은 쓰지 못합니다. */
const noPrescribing = testMember({ grants: [{ permission: 'prescription:write', effect: 'REVOKE' }] })
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

function app(store: 'memory' | 'sqlite') {
  const seeds = Layer.mergeAll(doctor.seed, desk.seed, therapist.seed, noPrescribing.seed, elsewhere.seed).pipe(
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

interface Body {
  id: string
  code: string
  [key: string]: unknown
}
const json = (response: Response) => response.json() as Promise<Body>

const acupuncture = {
  kind: 'ACUPUNCTURE',
  feeCode: '40011',
  categoryCode: '33001001',
  name: '침술',
  dose: { perDay: 1, days: 1 },
  unitPrice: 4_210,
}

/** 접수하고 기록해 완료한 진료(버전 3, 1판)의 ID입니다. `complete`가 거짓이면 초안(버전 1)입니다. */
async function encounter(send: ReturnType<typeof app>, complete = true) {
  const patient = await json(await send('POST', '/patients', { as: desk, body: { name: '홍길동' } }))
  const visit = await json(
    await send('POST', '/visits:check-in', { as: desk, body: { patientId: patient.id, coverage: 'SELF_PAY' } }),
  )
  const encounterId = visit['encounterId'] as string
  if (complete) {
    await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"1"',
      body: {
        diagnoses: { upsert: [{ code: 'U23.4', kind: 'PRIMARY' }] },
        prescriptionLines: { upsert: [acupuncture] },
      },
    })
    expect((await send('POST', `/encounters/${encounterId}:complete`, { ifMatch: '"2"', body: {} })).status).toBe(200)
  }
  return encounterId
}

const propose = (send: ReturnType<typeof app>, encounterId: string, changes: unknown, as = desk) =>
  send('POST', `/encounters/${encounterId}/amendment-proposals`, { as, body: { reason: '상병 누락', changes } })

const secondaryDiagnosis = {
  diagnoses: {
    upsert: [
      { code: 'U23.4', kind: 'PRIMARY' },
      { code: 'M54.5', kind: 'SECONDARY' },
    ],
  },
}

describe.each(['memory', 'sqlite'] as const)('amendment proposals HTTP (%s)', (store) => {
  it('lets the desk propose and a doctor apply it as an amendment with a new revision', async () => {
    const send = app(store)
    const encounterId = await encounter(send)
    const proposed = await propose(send, encounterId, secondaryDiagnosis)
    expect(proposed.status).toBe(201)
    const proposal = await json(proposed)
    expect(proposal).toMatchObject({ status: 'PENDING', baseRevision: 1, stale: false, source: 'USER' })

    const pending = await json(
      await send('GET', `/encounters/${encounterId}/amendment-proposals?status=PENDING`, { as: desk }),
    )
    expect((pending['items'] as Body[]).map((each) => each.id)).toEqual([proposal.id])

    const applied = await send('POST', `/amendment-proposals/${proposal.id}:apply`, { body: {} })
    expect(applied.status).toBe(200)
    expect(applied.headers.get('etag')).toBe('"4"')
    const body = await json(applied)
    expect(body['encounter']).toMatchObject({ status: 'AMENDED', revision: 2, version: 4 })
    expect(body['proposal']).toMatchObject({
      status: 'APPLIED',
      stale: false,
      resolution: { by: doctor.access.userId, revision: 2, reason: null },
    })
    const revision = await json(await send('GET', `/encounters/${encounterId}/versions/2`))
    expect(revision).toMatchObject({ source: 'AMENDMENT', reason: '상병 누락' })
    expect(revision['diagnoses']).toHaveLength(2)

    const again = await send('POST', `/amendment-proposals/${proposal.id}:apply`, { body: {} })
    expect(again.status).toBe(409)
    expect(await json(again)).toMatchObject({ code: 'AMENDMENT_PROPOSAL_NOT_PENDING', currentStatus: 'APPLIED' })
    expect(
      (await json(await send('GET', `/encounters/${encounterId}/amendment-proposals?status=PENDING`)))['items'],
    ).toEqual([])
  })

  it('refuses proposals the encounter cannot take', async () => {
    const send = app(store)
    const draft = await encounter(send, false)
    const encounterId = await encounter(send)
    const onDraft = await propose(send, draft, secondaryDiagnosis)
    const empty = await propose(send, encounterId, { diagnoses: { upsert: [{ code: 'U23.4', kind: 'PRIMARY' }] } })
    const invalid = await propose(send, encounterId, { diagnoses: { remove: ['dx_01JBQ000000000000000000009'] } })
    const noReason = await send('POST', `/encounters/${encounterId}/amendment-proposals`, {
      as: desk,
      body: { changes: secondaryDiagnosis },
    })
    expect(await json(onDraft)).toMatchObject({ code: 'ENCOUNTER_NOT_EDITABLE', currentStatus: 'DRAFT' })
    expect(empty.status).toBe(422)
    expect(await json(empty)).toMatchObject({ code: 'AMENDMENT_PROPOSAL_EMPTY' })
    expect(await json(invalid)).toMatchObject({ code: 'ENCOUNTER_CHANGE_INVALID' })
    expect(noReason.status).toBe(400)
  })

  it('checks who may propose, apply and dismiss, and keeps tenants apart', async () => {
    const send = app(store)
    const encounterId = await encounter(send)
    const byTherapist = await propose(send, encounterId, secondaryDiagnosis, therapist)
    const proposal = await json(await propose(send, encounterId, secondaryDiagnosis))
    const applyByDesk = await send('POST', `/amendment-proposals/${proposal.id}:apply`, { as: desk, body: {} })
    const dismissByDesk = await send('POST', `/amendment-proposals/${proposal.id}:dismiss`, {
      as: desk,
      body: { reason: '취소' },
    })
    const fromElsewhere = await send('GET', `/amendment-proposals/${proposal.id}`, { as: elsewhere })
    const proposeElsewhere = await propose(send, encounterId, secondaryDiagnosis, elsewhere)

    expect(byTherapist.status).toBe(403)
    expect(applyByDesk.status).toBe(403)
    expect(dismissByDesk.status).toBe(403)
    expect(fromElsewhere.status).toBe(404)
    expect(proposeElsewhere.status).toBe(404)
  })

  it('does not apply a proposal made before a later amendment, and lets a doctor dismiss it', async () => {
    const send = app(store)
    const encounterId = await encounter(send)
    const proposal = await json(await propose(send, encounterId, secondaryDiagnosis))
    await send('POST', `/encounters/${encounterId}:amend`, {
      ifMatch: '"3"',
      body: { reason: '본문 정정', changes: { note: { body: '<p>요통</p>' } } },
    })
    const listed = await json(await send('GET', `/encounters/${encounterId}/amendment-proposals`))
    const stale = await send('POST', `/amendment-proposals/${proposal.id}:apply`, { body: {} })
    const dismissed = await send('POST', `/amendment-proposals/${proposal.id}:dismiss`, {
      body: { reason: '낡은 제안' },
    })
    const again = await send('POST', `/amendment-proposals/${proposal.id}:dismiss`, { body: { reason: '다시' } })

    expect((listed['items'] as Body[])[0]).toMatchObject({ stale: true })
    expect(stale.status).toBe(409)
    expect(await json(stale)).toMatchObject({
      code: 'AMENDMENT_PROPOSAL_STALE',
      baseRevision: 1,
      currentRevision: 2,
    })
    expect(await json(dismissed)).toMatchObject({
      status: 'DISMISSED',
      stale: false,
      resolution: { by: doctor.access.userId, revision: null, reason: '낡은 제안' },
    })
    expect(await json(again)).toMatchObject({ code: 'AMENDMENT_PROPOSAL_NOT_PENDING', currentStatus: 'DISMISSED' })
  })

  it('applies with the checks of an amendment and leaves the proposal pending when they fail', async () => {
    const send = app(store)
    const encounterId = await encounter(send)
    const lines = await json(await propose(send, encounterId, { prescriptionLines: { upsert: [acupuncture] } }))
    const notes = await json(await propose(send, encounterId, { note: { body: '<p>요통</p>' } }))

    const withoutPrescribing = await send('POST', `/amendment-proposals/${lines.id}:apply`, {
      as: noPrescribing,
      body: {},
    })
    await send('POST', `/encounters/${encounterId}:lock`, { ifMatch: '"3"' })
    const locked = await send('POST', `/amendment-proposals/${notes.id}:apply`, { body: {} })
    const stillPending = await json(await send('GET', `/amendment-proposals/${notes.id}`))

    expect(withoutPrescribing.status).toBe(403)
    expect(await json(withoutPrescribing)).toMatchObject({ code: 'PERMISSION_DENIED' })
    expect(locked.status).toBe(409)
    expect(await json(locked)).toMatchObject({ code: 'ENCOUNTER_LOCKED' })
    expect(stillPending).toMatchObject({ status: 'PENDING', resolution: null })
  })
})
