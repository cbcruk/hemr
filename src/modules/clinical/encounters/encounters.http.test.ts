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
/** 진료기록은 쓰지만 처방은 쓰지 못합니다. */
const noPrescribing = testMember({ grants: [{ permission: 'prescription:write', effect: 'REVOKE' }] })
/** 처방은 쓰지만 PRN 처방은 쓰지 못합니다. */
const noPrn = testMember({ grants: [{ permission: 'prescription:write_prn', effect: 'REVOKE' }] })
/** 진료기록만 쓰고 처방은 PRN까지 모두 쓰지 못합니다. */
const noLines = testMember({
  grants: [
    { permission: 'prescription:write', effect: 'REVOKE' },
    { permission: 'prescription:write_prn', effect: 'REVOKE' },
  ],
})
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
  const seeds = Layer.mergeAll(
    doctor.seed,
    desk.seed,
    unlicensed.seed,
    noPrescribing.seed,
    noPrn.seed,
    noLines.seed,
    elsewhere.seed,
  ).pipe(Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')))
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
      body: { vitals: [], diagnoses: { upsert: [{ code: 'u23', kind: 'PRIMARY' }] } },
    })

    expect(missing.status).toBe(400)
    expect(excess.status).toBe(400)
    expect(((await json(excess))['violations'] as Body[]).map((each) => each['field'])).toEqual([
      'vitals',
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

  it('비운 편집기 노트는 내용 없음으로 봐 연쇄 없이 취소되고, 취소한 내원의 진료는 고칠 수 없습니다', async () => {
    const send = app()
    const { visit, encounterId } = await checkedIn(send)
    await send('PATCH', `/encounters/${encounterId}`, { ifMatch: '"1"', body: { note: { body: '<p><br></p>' } } })
    const canceled = await send('POST', `/visits/${visit.id}:cancel`, { as: desk, body: { reason: '취소' } })
    // 빈 초안의 철회는 정책이 나중에 합니다(M5). 그 전에도 취소한 내원의 진료는 고칠 수 없습니다
    const late = await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"2"',
      body: { note: { body: '<p>요통</p>' } },
    })

    expect(canceled.status).toBe(200)
    expect(late.status).toBe(409)
    expect(await json(late)).toMatchObject({ code: 'ENCOUNTER_VISIT_CANCELED' })
  })
})

/** 처방 라인 하나입니다. 시험마다 필요한 필드만 바꿉니다. */
const acupuncture = {
  kind: 'ACUPUNCTURE',
  feeCode: '40011',
  categoryCode: '33001001',
  name: '침술',
  dose: { perDay: 1, days: 1 },
  unitPrice: 4_210,
}

describe.each(['memory', 'sqlite'] as const)('encounter prescription lines HTTP (%s)', (store) => {
  it('saves lines with server amounts, maps clientRefs, warns about coverage and replaces a line by ID', async () => {
    const send = app(store)
    const { encounterId } = await checkedIn(send)
    const saved = await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"1"',
      body: {
        prescriptionLines: {
          upsert: [
            { ...acupuncture, clientRef: 'temp1', dose: { perDay: 2, days: 1 } },
            // 자보 전용 카테고리라 자보가 아닌 진료에서는 경고입니다
            {
              ...acupuncture,
              clientRef: 'temp2',
              categoryCode: '73001001',
              unitPrice: 12_345,
              dose: { perDay: 0.5, days: 3 },
            },
          ],
        },
      },
    })
    const body = await json(saved)
    const lines = (body['encounter'] as { prescriptionLines: Body[] }).prescriptionLines
    const refs = body['prescriptionLineRefs'] as Array<{ clientRef: string; id: string }>
    const replaced = await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"2"',
      body: {
        prescriptionLines: { upsert: [{ ...acupuncture, id: lines[1]!.id, prn: true }], remove: [lines[0]!.id] },
      },
    })
    const after = await json(await send('GET', `/encounters/${encounterId}`, { as: desk }))

    expect(saved.status).toBe(200)
    expect(lines).toMatchObject([
      { id: expect.stringMatching(/^pl_/), unitPrice: 4_210, amount: 8_420, prn: false },
      { id: expect.stringMatching(/^pl_/), categoryCode: '73001001', amount: 18_518 },
    ])
    expect(refs).toEqual([
      { clientRef: 'temp1', id: lines[0]!.id },
      { clientRef: 'temp2', id: lines[1]!.id },
    ])
    expect(body['warnings']).toEqual([
      { code: 'COVERAGE_CATEGORY_MISMATCH', message: expect.any(String), targets: [lines[1]!.id] },
    ])
    expect(replaced.status).toBe(200)
    expect(await json(replaced)).toMatchObject({ warnings: [], prescriptionLineRefs: [] })
    expect(after['prescriptionLines']).toEqual([
      { ...acupuncture, id: lines[1]!.id, feeCode: '40011', amount: 4_210, prn: true },
    ])
    expect(after['version']).toBe(3)
  })
})

describe('encounter prescription lines HTTP', () => {
  it('needs prescription:write for lines, and prescription:write_prn for PRN lines', async () => {
    const send = app()
    const { encounterId } = await checkedIn(send)
    const lines = { prescriptionLines: { upsert: [acupuncture] } }
    const byNoPrescribing = await send('PATCH', `/encounters/${encounterId}`, {
      as: noPrescribing,
      ifMatch: '"1"',
      body: lines,
    })
    const noteByNoPrescribing = await send('PATCH', `/encounters/${encounterId}`, {
      as: noPrescribing,
      ifMatch: '"1"',
      body: { note: { body: '요통' } },
    })
    const prnByNoPrn = await send('PATCH', `/encounters/${encounterId}`, {
      as: noPrn,
      ifMatch: '"2"',
      body: { prescriptionLines: { upsert: [{ ...acupuncture, prn: true }] } },
    })
    const byNoPrn = await send('PATCH', `/encounters/${encounterId}`, { as: noPrn, ifMatch: '"2"', body: lines })

    expect(byNoPrescribing.status).toBe(403)
    expect(await json(byNoPrescribing)).toMatchObject({ code: 'PERMISSION_DENIED', missing: ['prescription:write'] })
    expect(noteByNoPrescribing.status).toBe(200)
    expect(prnByNoPrn.status).toBe(403)
    expect(await json(prnByNoPrn)).toMatchObject({ missing: ['prescription:write_prn'] })
    expect(byNoPrn.status).toBe(200)
  })

  it('lists every missing permission, checks them before the version, and skips them for empty line changes', async () => {
    const send = app()
    const { encounterId } = await checkedIn(send)
    const prn = await send('PATCH', `/encounters/${encounterId}`, {
      as: noLines,
      ifMatch: '"9"',
      body: { prescriptionLines: { upsert: [{ ...acupuncture, prn: true }] } },
    })
    const empty = await send('PATCH', `/encounters/${encounterId}`, {
      as: noLines,
      ifMatch: '"1"',
      body: { note: { body: '요통' }, prescriptionLines: { upsert: [], remove: [] } },
    })

    expect(prn.status).toBe(403)
    expect(await json(prn)).toMatchObject({ missing: ['prescription:write', 'prescription:write_prn'] })
    expect(empty.status).toBe(200)
  })

  it('lets a user without prescription:write_prn turn PRN off and remove PRN lines', async () => {
    const send = app()
    const { encounterId } = await checkedIn(send)
    const saved = await json(
      await send('PATCH', `/encounters/${encounterId}`, {
        ifMatch: '"1"',
        body: {
          prescriptionLines: {
            upsert: [
              { ...acupuncture, prn: true },
              { ...acupuncture, prn: true },
            ],
          },
        },
      }),
    )
    const [first, second] = (saved['encounter'] as { prescriptionLines: Body[] }).prescriptionLines
    const changed = await send('PATCH', `/encounters/${encounterId}`, {
      as: noPrn,
      ifMatch: '"2"',
      body: { prescriptionLines: { upsert: [{ ...acupuncture, id: first!.id }], remove: [second!.id] } },
    })

    expect(changed.status).toBe(200)
    expect(((await json(changed))['encounter'] as { prescriptionLines: Body[] }).prescriptionLines).toEqual([
      { ...acupuncture, id: first!.id, amount: 4_210, prn: false },
    ])
  })

  it('rejects unknown lines with 422 and amounts sent by the client with 400', async () => {
    const send = app()
    const { encounterId } = await checkedIn(send)
    const unknown = await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"1"',
      body: {
        prescriptionLines: { remove: ['pl_01JBQ000000000000000000009'] },
        diagnoses: { remove: ['dx_01JBQ000000000000000000009'] },
      },
    })
    const withAmount = await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"1"',
      body: { prescriptionLines: { upsert: [{ ...acupuncture, amount: 1, unitPrice: 1.234 }] } },
    })

    expect(unknown.status).toBe(422)
    expect(await json(unknown)).toMatchObject({
      code: 'ENCOUNTER_CHANGE_INVALID',
      // 상병 이유가 먼저입니다
      errors: [
        { reason: 'DIAGNOSIS_NOT_FOUND', target: 'dx_01JBQ000000000000000000009' },
        { reason: 'PRESCRIPTION_LINE_NOT_FOUND', target: 'pl_01JBQ000000000000000000009' },
      ],
    })
    expect(withAmount.status).toBe(400)
    expect(((await json(withAmount))['violations'] as Body[]).map((each) => each['field'])).toEqual([
      'prescriptionLines.upsert[0].amount',
      'prescriptionLines.upsert[0].unitPrice',
    ])
  })

  it('counts prescription lines as clinical data when canceling the visit', async () => {
    const send = app()
    const { visit, encounterId } = await checkedIn(send)
    await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"1"',
      body: { prescriptionLines: { upsert: [acupuncture] } },
    })
    const canceled = await send('POST', `/visits/${visit.id}:cancel`, { as: desk, body: { reason: '취소' } })

    expect(canceled.status).toBe(409)
    expect(await json(canceled)).toMatchObject({ code: 'VISIT_HAS_CLINICAL_DATA' })
  })
})

/** 완료할 수 있게 주상병 하나와 처방 라인 하나를 저장합니다. 버전은 2가 됩니다. */
async function charted(send: ReturnType<typeof app>, encounterId: string) {
  await send('PATCH', `/encounters/${encounterId}`, {
    ifMatch: '"1"',
    body: { diagnoses: { upsert: [{ code: 'U23.4', kind: 'PRIMARY' }] }, prescriptionLines: { upsert: [acupuncture] } },
  })
}

describe.each(['memory', 'sqlite'] as const)('encounter completion HTTP (%s)', (store) => {
  it('completes the draft, sends the visit to the treatment room and refuses later edits', async () => {
    const send = app(store)
    const { visit, encounterId } = await checkedIn(send)
    await charted(send, encounterId)
    const completed = await send('POST', `/encounters/${encounterId}:complete`, { ifMatch: '"2"', body: {} })
    const body = await json(completed)
    const edit = await send('PATCH', `/encounters/${encounterId}`, { ifMatch: '"3"', body: { note: { body: 'x' } } })
    const again = await send('POST', `/encounters/${encounterId}:complete`, { ifMatch: '"3"', body: {} })

    expect(completed.status).toBe(200)
    expect(completed.headers.get('etag')).toBe('"3"')
    expect(body['encounter']).toMatchObject({
      status: 'COMPLETED',
      completedAt: expect.any(String),
      doctorId: doctor.user.id,
      version: 3,
    })
    expect(body['visit']).toMatchObject({ id: visit.id, status: 'IN_TREATMENT', version: 2 })
    expect((await json(await send('GET', `/visits/${visit.id}`, { as: desk })))['status']).toBe('IN_TREATMENT')
    expect(edit.status).toBe(409)
    expect(await json(edit)).toMatchObject({ code: 'ENCOUNTER_NOT_EDITABLE', currentStatus: 'COMPLETED' })
    expect(again.status).toBe(409)
  })

  it('rejects a draft that fails the completion rules with every reason and keeps it a draft', async () => {
    const send = app(store)
    const { encounterId } = await checkedIn(send)
    await send('PATCH', `/encounters/${encounterId}`, {
      ifMatch: '"1"',
      body: { prescriptionLines: { upsert: [{ ...acupuncture, categoryCode: '73001001' }] } },
    })
    const rejected = await send('POST', `/encounters/${encounterId}:complete`, { ifMatch: '"2"', body: {} })

    expect(rejected.status).toBe(422)
    expect(await json(rejected)).toMatchObject({
      code: 'ENCOUNTER_COMPLETION_REJECTED',
      violations: [{ code: 'PRIMARY_DIAGNOSIS_MISSING' }, { code: 'COVERAGE_CATEGORY_MISMATCH' }],
    })
    expect(await json(await send('GET', `/encounters/${encounterId}`))).toMatchObject({ status: 'DRAFT', version: 2 })
  })
})

describe('encounter save and visit cancel HTTP (sqlite)', () => {
  it('never leaves a charted encounter on a visit canceled at the same moment', async () => {
    const send = app('sqlite')
    for (let round = 0; round < 5; round++) {
      const { visit, encounterId } = await checkedIn(send)
      const [saved, canceled] = await Promise.all([
        send('PATCH', `/encounters/${encounterId}`, { ifMatch: '"1"', body: { note: { body: '<p>요통</p>' } } }),
        send('POST', `/visits/${visit.id}:cancel`, { as: desk, body: { reason: '취소' } }),
      ])

      // 먼저 들어간 쪽만 이깁니다. 저장이 먼저면 취소가 진료 내용을 보고(409), 취소가 먼저면 진료를 철회해 저장의
      // 버전이 어긋납니다(412)
      expect(
        (saved.status === 200 && canceled.status === 409) || (canceled.status === 200 && saved.status === 412),
      ).toBe(true)
    }
  })
})

describe('encounter completion HTTP (sqlite)', () => {
  it('never fails with 500 when the desk moves the visit at the same moment', async () => {
    const send = app('sqlite')
    const { visit, encounterId } = await checkedIn(send)
    await charted(send, encounterId)
    const [completed, started] = await Promise.all([
      send('POST', `/encounters/${encounterId}:complete`, { ifMatch: '"2"', body: {} }),
      send('POST', `/visits/${visit.id}:start-treatment`, { as: desk }),
    ])

    expect(completed.status).toBe(200)
    // 먼저 들어간 쪽이 내원을 치료실로 옮기고, 뒤에 온 내원 커맨드는 409, 뒤에 온 완료는 내원을 그대로 둡니다
    expect([200, 409]).toContain(started.status)
    expect((await json(await send('GET', `/visits/${visit.id}`, { as: desk })))['status']).toBe('IN_TREATMENT')
  })
})

describe('encounter completion HTTP', () => {
  it('sends the visit where nextVisitStatus says, and leaves it alone when it is already there', async () => {
    const send = app()
    const checkout = await checkedIn(send)
    const waiting = await checkedIn(send)
    await charted(send, checkout.encounterId)
    await charted(send, waiting.encounterId)
    const toCheckout = await send('POST', `/encounters/${checkout.encounterId}:complete`, {
      ifMatch: '"2"',
      body: { nextVisitStatus: 'AWAITING_PAYMENT' },
    })
    const stay = await send('POST', `/encounters/${waiting.encounterId}:complete`, {
      ifMatch: '"2"',
      body: { nextVisitStatus: 'WAITING' },
    })

    expect((await json(toCheckout))['visit']).toMatchObject({ status: 'AWAITING_PAYMENT', version: 2 })
    expect((await json(stay))['visit']).toMatchObject({ status: 'WAITING', version: 1 })
  })

  it('needs If-Match, the current version and encounter:write, and takes only known acknowledgements', async () => {
    const send = app()
    const { encounterId } = await checkedIn(send)
    await charted(send, encounterId)
    const missing = await send('POST', `/encounters/${encounterId}:complete`, { body: {} })
    const stale = await send('POST', `/encounters/${encounterId}:complete`, { ifMatch: '"1"', body: {} })
    const byDesk = await send('POST', `/encounters/${encounterId}:complete`, { as: desk, ifMatch: '"2"', body: {} })
    const unknown = await send('POST', `/encounters/${encounterId}:complete`, {
      ifMatch: '"2"',
      body: { acknowledge: ['PRIMARY_DIAGNOSIS_MISSING'] },
    })

    expect(missing.status).toBe(400)
    expect(stale.status).toBe(412)
    expect(byDesk.status).toBe(403)
    expect(unknown.status).toBe(400)
    expect((await json(await send('GET', `/encounters/${encounterId}`)))['status']).toBe('DRAFT')
  })

  it('취소한 내원의 진료는 철회 정책이 돌기 전에도 완료할 수 없습니다', async () => {
    const send = app()
    const { visit, encounterId } = await checkedIn(send)
    await send('POST', `/visits/${visit.id}:cancel`, { as: desk, body: { reason: '취소' } })
    const completed = await send('POST', `/encounters/${encounterId}:complete`, { ifMatch: '"1"', body: {} })

    expect(completed.status).toBe(409)
    expect(await json(completed)).toMatchObject({ code: 'ENCOUNTER_VISIT_CANCELED' })
  })
})

describe('encounter completion and the visit flow', () => {
  it('leaves a visit at checkout alone unless asked', async () => {
    const send = app()
    const atCheckout = await checkedIn(send)
    const moved = await checkedIn(send)
    for (const each of [atCheckout, moved]) {
      await charted(send, each.encounterId)
      await send('POST', `/visits/${each.visit.id}:send-to-checkout`, { as: desk })
    }

    const stay = await send('POST', `/encounters/${atCheckout.encounterId}:complete`, { ifMatch: '"2"', body: {} })
    const back = await send('POST', `/encounters/${moved.encounterId}:complete`, {
      ifMatch: '"2"',
      body: { nextVisitStatus: 'IN_TREATMENT' },
    })

    expect((await json(stay))['visit']).toMatchObject({ status: 'AWAITING_PAYMENT', version: 2 })
    expect((await json(back))['visit']).toMatchObject({ status: 'IN_TREATMENT', version: 3 })
  })
})

/** 접수하고 기록해 완료한 진료(버전 3, 1판)를 만듭니다. */
async function completed(send: ReturnType<typeof app>) {
  const checked = await checkedIn(send)
  await charted(send, checked.encounterId)
  await send('POST', `/encounters/${checked.encounterId}:complete`, { ifMatch: '"2"', body: {} })
  return checked
}

describe.each(['memory', 'sqlite'] as const)('encounter amendment HTTP (%s)', (store) => {
  it('amends a completed encounter into a new revision and keeps every earlier revision', async () => {
    const send = app(store)
    const { encounterId } = await completed(send)
    const amended = await send('POST', `/encounters/${encounterId}:amend`, {
      ifMatch: '"3"',
      body: {
        reason: '상병 정정',
        changes: {
          note: { body: '<p>요통 호전</p>' },
          diagnoses: {
            upsert: [
              { code: 'U23.4', kind: 'PRIMARY' },
              { code: 'M54.5', kind: 'SECONDARY' },
            ],
          },
        },
      },
    })
    const twice = await send('POST', `/encounters/${encounterId}:amend`, {
      ifMatch: '"4"',
      body: { reason: '본문 정정', changes: { note: { body: '<p>요통 호전, 재진</p>' } } },
    })
    const revisions = await json(await send('GET', `/encounters/${encounterId}/versions`, { as: desk }))
    const first = await json(await send('GET', `/encounters/${encounterId}/versions/1`, { as: desk }))
    const missing = await send('GET', `/encounters/${encounterId}/versions/4`)

    expect(amended.status).toBe(200)
    expect(amended.headers.get('etag')).toBe('"4"')
    expect((await json(amended))['encounter']).toMatchObject({ status: 'AMENDED', revision: 2, version: 4 })
    expect((await json(twice))['encounter']).toMatchObject({ status: 'AMENDED', revision: 3, version: 5 })
    expect((revisions['items'] as Body[]).map((each) => [each['revision'], each['source'], each['reason']])).toEqual([
      [1, 'COMPLETION', null],
      [2, 'AMENDMENT', '상병 정정'],
      [3, 'AMENDMENT', '본문 정정'],
    ])
    expect(first).toMatchObject({
      revision: 1,
      note: { body: '' },
      diagnoses: [{ code: 'U23.4' }],
      prescriptionLines: [{ feeCode: '40011' }],
      recordedBy: doctor.user.id,
    })
    expect(missing.status).toBe(404)
    expect(await json(missing)).toMatchObject({ code: 'ENCOUNTER_REVISION_NOT_FOUND' })
  })

  it('locks a record against amendment and retraction until it is unlocked', async () => {
    const send = app(store)
    const { encounterId } = await completed(send)
    const locked = await send('POST', `/encounters/${encounterId}:lock`, { ifMatch: '"3"' })
    const again = await send('POST', `/encounters/${encounterId}:lock`, { ifMatch: '"4"' })
    const amend = await send('POST', `/encounters/${encounterId}:amend`, {
      ifMatch: '"4"',
      body: { reason: '정정', changes: { note: { body: 'x' } } },
    })
    const retract = await send('POST', `/encounters/${encounterId}:retract`, {
      ifMatch: '"4"',
      body: { reason: '오기' },
    })
    const unlocked = await send('POST', `/encounters/${encounterId}:unlock`, { ifMatch: '"4"' })
    const afterUnlock = await send('POST', `/encounters/${encounterId}:amend`, {
      ifMatch: '"5"',
      body: { reason: '정정', changes: { note: { body: 'x' } } },
    })

    expect(locked.status).toBe(200)
    expect(await json(locked)).toMatchObject({ locked: true, version: 4 })
    expect(again.headers.get('etag')).toBe('"4"')
    expect(amend.status).toBe(409)
    expect(await json(amend)).toMatchObject({ code: 'ENCOUNTER_LOCKED' })
    expect(retract.status).toBe(409)
    expect(await json(unlocked)).toMatchObject({ locked: false, version: 5 })
    expect(afterUnlock.status).toBe(200)
  })
})

describe('encounter amendment HTTP', () => {
  it('runs the completion rules on the amended record and leaves a change with nothing new alone', async () => {
    const send = app()
    const { encounterId } = await completed(send)
    const draft = await checkedIn(send)
    const [primary] = (await json(await send('GET', `/encounters/${encounterId}`)))['diagnoses'] as Body[]
    const rejected = await send('POST', `/encounters/${encounterId}:amend`, {
      ifMatch: '"3"',
      body: { reason: '상병 삭제', changes: { diagnoses: { remove: [primary!.id] } } },
    })
    const unchanged = await send('POST', `/encounters/${encounterId}:amend`, {
      ifMatch: '"3"',
      body: { reason: '정정', changes: { note: { body: '' } } },
    })
    const onDraft = await send('POST', `/encounters/${draft.encounterId}:amend`, {
      ifMatch: '"1"',
      body: { reason: '정정', changes: {} },
    })

    expect(rejected.status).toBe(422)
    expect(await json(rejected)).toMatchObject({
      code: 'ENCOUNTER_COMPLETION_REJECTED',
      violations: [{ code: 'PRIMARY_DIAGNOSIS_MISSING' }],
    })
    expect(unchanged.status).toBe(200)
    expect((await json(unchanged))['encounter']).toMatchObject({ status: 'COMPLETED', revision: 1, version: 3 })
    expect(onDraft.status).toBe(409)
    expect(await json(onDraft)).toMatchObject({ code: 'ENCOUNTER_NOT_EDITABLE', currentStatus: 'DRAFT' })
    expect((await json(await send('GET', `/encounters/${draft.encounterId}/versions`)))['items']).toEqual([])
  })

  it('needs encounter:amend, encounter:retract and the prescription permissions for lines', async () => {
    const send = app()
    const { encounterId } = await completed(send)
    const byDesk = await send('POST', `/encounters/${encounterId}:amend`, {
      as: desk,
      ifMatch: '"3"',
      body: { reason: '정정', changes: {} },
    })
    const lines = await send('POST', `/encounters/${encounterId}:amend`, {
      as: noPrescribing,
      ifMatch: '"3"',
      body: { reason: '정정', changes: { prescriptionLines: { upsert: [acupuncture] } } },
    })
    const retractByDesk = await send('POST', `/encounters/${encounterId}:retract`, {
      as: desk,
      ifMatch: '"3"',
      body: { reason: '오기' },
    })
    const lockByUnlicensed = await send('POST', `/encounters/${encounterId}:lock`, { as: unlicensed, ifMatch: '"3"' })
    const noReason = await send('POST', `/encounters/${encounterId}:amend`, { ifMatch: '"3"', body: { changes: {} } })

    expect(byDesk.status).toBe(403)
    expect(await json(byDesk)).toMatchObject({ missing: ['encounter:amend'] })
    expect(lines.status).toBe(403)
    expect(await json(lines)).toMatchObject({ missing: ['prescription:write'] })
    expect(retractByDesk.status).toBe(403)
    expect(lockByUnlicensed.status).toBe(403)
    expect(noReason.status).toBe(400)
  })
})

describe.each(['memory', 'sqlite'] as const)('encounter retraction HTTP (%s)', (store) => {
  it('retracts with a reason, keeps the record and refuses anything after', async () => {
    const send = app(store)
    const { encounterId } = await completed(send)
    const retracted = await send('POST', `/encounters/${encounterId}:retract`, {
      ifMatch: '"3"',
      body: { reason: '다른 환자 기록' },
    })
    const again = await send('POST', `/encounters/${encounterId}:retract`, { ifMatch: '"4"', body: { reason: '오기' } })
    const amend = await send('POST', `/encounters/${encounterId}:amend`, {
      ifMatch: '"4"',
      body: { reason: '정정', changes: { note: { body: 'x' } } },
    })

    expect(retracted.status).toBe(200)
    expect(await json(retracted)).toMatchObject({
      status: 'ENTERED_IN_ERROR',
      retraction: { reason: '다른 환자 기록', retractedAt: expect.any(String), retractedBy: doctor.user.id },
      diagnoses: [{ code: 'U23.4' }],
      version: 4,
    })
    expect(again.status).toBe(409)
    expect(await json(again)).toMatchObject({ code: 'ENCOUNTER_NOT_EDITABLE', currentStatus: 'ENTERED_IN_ERROR' })
    expect(amend.status).toBe(409)
    expect(((await json(await send('GET', `/encounters/${encounterId}/versions`)))['items'] as Body[]).length).toBe(1)
  })

  it('lets the desk cancel a visit whose charted draft the doctor retracted', async () => {
    const send = app(store)
    const { visit, encounterId } = await checkedIn(send)
    await send('PATCH', `/encounters/${encounterId}`, { ifMatch: '"1"', body: { note: { body: '<p>요통</p>' } } })
    await send('POST', `/encounters/${encounterId}:retract`, { ifMatch: '"2"', body: { reason: '다른 환자' } })
    const canceled = await send('POST', `/visits/${visit.id}:cancel`, { as: desk, body: { reason: '재접수' } })
    const encounter = await json(await send('GET', `/encounters/${encounterId}`))

    expect(canceled.status).toBe(200)
    // 이미 철회한 진료는 다시 철회하지 않아 처음 사유가 남습니다
    expect(encounter).toMatchObject({ status: 'ENTERED_IN_ERROR', retraction: { reason: '다른 환자' }, version: 3 })
  })

  it('retracts the encounter of a visit canceled with cascade, even a locked one', async () => {
    const send = app(store)
    const { visit, encounterId } = await completed(send)
    await send('POST', `/encounters/${encounterId}:lock`, { ifMatch: '"3"' })
    const canceled = await send('POST', `/visits/${visit.id}:cancel`, { body: { reason: '이중 접수', cascade: true } })
    const encounter = await json(await send('GET', `/encounters/${encounterId}`))

    expect(canceled.status).toBe(200)
    expect(encounter).toMatchObject({ status: 'ENTERED_IN_ERROR', retraction: { reason: '이중 접수' }, version: 5 })
  })
})
