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
/** 수납 권한이 없습니다. */
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
  ifMatch?: string
  key?: string
}

function app(store: 'memory' | 'sqlite') {
  const seeds = Layer.mergeAll(doctor.seed, desk.seed, therapist.seed, elsewhere.seed).pipe(
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
    if (init.ifMatch !== undefined) headers['if-match'] = init.ifMatch
    if (init.key !== undefined) headers['idempotency-key'] = init.key
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

const nonbenefit = (unitPrice: number) => ({
  kind: 'NONBENEFIT',
  feeCode: null,
  categoryCode: '90001001',
  name: '약침',
  dose: { perDay: 1, days: 1 },
  unitPrice,
})

/** 일반 진료로 접수하고 비급여 처방을 저장해, 내원과 진료 ID를 돌려줍니다. */
async function charted(send: ReturnType<typeof app>, ...prices: number[]) {
  const patient = await json(await send('POST', '/patients', { body: { name: '홍길동' } }))
  const visit = await json(
    await send('POST', '/visits:check-in', { body: { patientId: patient.id, coverage: 'SELF_PAY' } }),
  )
  const encounterId = visit['encounterId'] as string
  if (prices.length > 0) {
    const saved = await send('PATCH', `/encounters/${encounterId}`, {
      as: doctor,
      ifMatch: '"1"',
      body: { prescriptionLines: { upsert: prices.map(nonbenefit) } },
    })
    expect(saved.status).toBe(200)
  }
  return { visit, encounterId }
}

const cash = (taxExempt: number) => ({ method: 'CASH', amount: { taxable: 0, taxExempt } })

describe.each(['memory', 'sqlite'] as const)('receipts HTTP (%s)', (store) => {
  it('quotes and checks out a visit, completing it and replaying the same key', async () => {
    const send = app(store)
    const { visit, encounterId } = await charted(send, 30_000, 12_500)

    const quote = await json(await send('POST', `/visits/${visit.id}:quote-checkout`, { body: {} }))
    const body = { quoteId: quote['quoteId'], payments: [cash(42_500)], memo: '현금' }
    const checkedOut = await send('POST', `/visits/${visit.id}:checkout`, { key: 'k1', body })
    const result = await json(checkedOut)
    const replayed = await json(await send('POST', `/visits/${visit.id}:checkout`, { key: 'k1', body }))
    const reused = await send('POST', `/visits/${visit.id}:checkout`, { key: 'k1', body: { ...body, memo: '다른' } })
    const again = await send('POST', `/visits/${visit.id}:checkout`, { key: 'k2', body })

    expect(quote).toMatchObject({
      quoteId: expect.stringMatching(/^qt_/),
      encounters: [{ encounterId, due: { taxable: 0, taxExempt: 42_500 } }],
      charges: { insuredCopay: 0, nonbenefit: { taxable: 0, taxExempt: 42_500 }, total: 42_500 },
      settlement: { remaining: 42_500, result: 'OUTSTANDING' },
      errors: [],
      warnings: ['OUTSTANDING'],
    })
    expect(checkedOut.status).toBe(200)
    expect(result['receipt']).toMatchObject({
      id: expect.stringMatching(/^rcp_/),
      visitId: visit.id,
      cashierId: desk.user.id,
      memo: '현금',
      encounterIds: [encounterId],
      quoteId: quote['quoteId'],
      payments: [{ id: expect.stringMatching(/^pay_/), method: 'CASH', amount: { taxable: 0, taxExempt: 42_500 } }],
      settlement: { result: 'PAID', outstanding: 0, received: { taxable: 0, taxExempt: 42_500 } },
      status: 'ACTIVE',
    })
    expect(result['visit']).toMatchObject({ id: visit.id, status: 'COMPLETED' })
    expect(replayed).toEqual(result)
    expect(reused.status).toBe(422)
    expect(await json(reused)).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
    expect(again.status).toBe(409)
    expect(await json(again)).toMatchObject({ code: 'VISIT_TRANSITION_INVALID', currentStatus: 'COMPLETED' })
  })

  it('refuses a stale quote, unconfirmed outstanding and payment methods the server or terminals make', async () => {
    const send = app(store)
    const { visit, encounterId } = await charted(send, 10_000)
    const quote = await json(await send('POST', `/visits/${visit.id}:quote-checkout`, { body: {} }))
    await send('PATCH', `/encounters/${encounterId}`, {
      as: doctor,
      ifMatch: '"2"',
      body: { prescriptionLines: { upsert: [nonbenefit(5_000)] } },
    })

    const stale = await send('POST', `/visits/${visit.id}:checkout`, { key: 'a', body: { quoteId: quote['quoteId'] } })
    const fresh = await json(await send('POST', `/visits/${visit.id}:quote-checkout`, { body: {} }))
    const unconfirmed = await send('POST', `/visits/${visit.id}:checkout`, {
      key: 'b',
      body: { quoteId: fresh['quoteId'] },
    })
    const card = await send('POST', `/visits/${visit.id}:checkout`, {
      key: 'c',
      body: {
        quoteId: fresh['quoteId'],
        payments: [
          { method: 'CARD', amount: { taxable: 0, taxExempt: 15_000 } },
          { method: 'JEJU_SUBSIDY', amount: { taxable: 0, taxExempt: 1 } },
        ],
      },
    })
    const confirmed = await json(
      await send('POST', `/visits/${visit.id}:checkout`, {
        key: 'b',
        body: { quoteId: fresh['quoteId'], payments: [cash(5_000)] },
      }),
    )

    expect(stale.status).toBe(409)
    expect(await json(stale)).toMatchObject({ code: 'QUOTE_STALE', quoteId: fresh['quoteId'] })
    expect(fresh['charges']).toMatchObject({ total: 15_000 })
    expect(unconfirmed.status).toBe(422)
    expect(await json(unconfirmed)).toMatchObject({ code: 'CHECKOUT_REJECTED', errors: [], warnings: ['OUTSTANDING'] })
    expect(card.status).toBe(422)
    expect(await json(card)).toMatchObject({ errors: ['PAYMENT_METHOD_NOT_ALLOWED'] })
    // 실패한 요청은 키를 남기지 않아 같은 키로 다시 보낼 수 있습니다. 결제가 있으면 미수 확인이 필요 없습니다
    expect(confirmed['receipt']).toMatchObject({ settlement: { result: 'OUTSTANDING', outstanding: 10_000 } })
  })

  it('writes off the remainder or confirms an outstanding balance with no payment', async () => {
    const send = app(store)
    const first = await charted(send, 8_000)
    const second = await charted(send, 8_000)
    const empty = await charted(send)
    const quoteOf = async (id: string) =>
      (await json(await send('POST', `/visits/${id}:quote-checkout`, { body: {} })))['quoteId']

    const writtenOff = await json(
      await send('POST', `/visits/${first.visit.id}:checkout`, {
        key: 'w',
        body: { quoteId: await quoteOf(first.visit.id), payments: [cash(3_000)], writeOffRemainder: true },
      }),
    )
    const acknowledged = await json(
      await send('POST', `/visits/${second.visit.id}:checkout`, {
        key: 'o',
        body: { quoteId: await quoteOf(second.visit.id), acknowledge: ['OUTSTANDING'] },
      }),
    )
    const zero = await json(
      await send('POST', `/visits/${empty.visit.id}:checkout`, {
        key: 'z',
        body: { quoteId: await quoteOf(empty.visit.id) },
      }),
    )

    expect(writtenOff['receipt']).toMatchObject({ settlement: { result: 'WRITTEN_OFF', writtenOff: 5_000 } })
    expect(acknowledged['receipt']).toMatchObject({
      payments: [],
      settlement: { result: 'OUTSTANDING', outstanding: 8_000, acknowledged: ['OUTSTANDING'] },
    })
    expect(zero['receipt']).toMatchObject({ charges: { total: 0 }, settlement: { result: 'PAID' } })
  })

  it('keeps the receipt with the visit when it is reopened or canceled', async () => {
    const send = app(store)
    const { visit } = await charted(send)
    const quote = await json(await send('POST', `/visits/${visit.id}:quote-checkout`, { body: {} }))
    const checkedOut = await json(
      await send('POST', `/visits/${visit.id}:checkout`, { key: 'k', body: { quoteId: quote['quoteId'] } }),
    )
    const receiptId = (checkedOut['receipt'] as Body).id

    const cancel = await send('POST', `/visits/${visit.id}:cancel`, { body: { reason: '잘못 접수' } })
    await send('POST', `/visits/${visit.id}:reopen`, { body: { reason: '추가 처방' } })
    const again = await send('POST', `/visits/${visit.id}:checkout`, { key: 'k2', body: { quoteId: quote['quoteId'] } })

    expect(cancel.status).toBe(409)
    expect(await json(cancel)).toMatchObject({ code: 'VISIT_HAS_CLINICAL_DATA' })
    expect(again.status).toBe(409)
    expect(await json(again)).toMatchObject({ code: 'RECEIPT_ALREADY_EXISTS', receiptId })
  })

  it('locks the billed prescription, cascade cancel and the quote of a checked-out visit', async () => {
    const send = app(store)
    const { visit, encounterId } = await charted(send, 10_000)
    const quote = await json(await send('POST', `/visits/${visit.id}:quote-checkout`, { body: {} }))
    const checkedOut = await json(
      await send('POST', `/visits/${visit.id}:checkout`, {
        key: 'k',
        body: {
          quoteId: quote['quoteId'],
          // 0원 행은 수단과 상관없이 기록하지 않습니다
          payments: [cash(10_000), { method: 'CARD', amount: { taxable: 0, taxExempt: 0 } }],
        },
      }),
    )
    const receiptId = (checkedOut['receipt'] as Body).id

    const lines = await send('PATCH', `/encounters/${encounterId}`, {
      as: doctor,
      ifMatch: '"2"',
      body: { prescriptionLines: { upsert: [nonbenefit(99_000)] } },
    })
    const note = await send('PATCH', `/encounters/${encounterId}`, {
      as: doctor,
      ifMatch: '"2"',
      body: { note: { body: '<p>수납 뒤 메모</p>' } },
    })
    const retract = await send('POST', `/encounters/${encounterId}:retract`, {
      as: doctor,
      ifMatch: '"3"',
      body: { reason: '잘못 기록' },
    })
    const cascade = await send('POST', `/visits/${visit.id}:cancel`, {
      as: doctor,
      body: { reason: '잘못 접수', cascade: true },
    })
    const requote = await send('POST', `/visits/${visit.id}:quote-checkout`, { body: {} })

    expect((checkedOut['receipt'] as Body)['payments']).toHaveLength(1)
    expect(lines.status).toBe(409)
    expect(await json(lines)).toMatchObject({ code: 'ENCOUNTER_BILLED', receiptId })
    expect(note.status).toBe(200)
    expect(retract.status).toBe(409)
    expect(await json(retract)).toMatchObject({ code: 'ENCOUNTER_BILLED', receiptId })
    expect(cascade.status).toBe(409)
    expect(await json(cascade)).toMatchObject({ code: 'VISIT_HAS_RECEIPT', receiptId })
    expect(requote.status).toBe(409)
    expect(await json(requote)).toMatchObject({ code: 'VISIT_TRANSITION_INVALID', currentStatus: 'COMPLETED' })
  })

  it('checks permissions, headers, payloads, encounters and tenants', async () => {
    const send = app(store)
    const { visit } = await charted(send, 1_000)
    const quote = await json(await send('POST', `/visits/${visit.id}:quote-checkout`, { body: {} }))
    const body = { quoteId: quote['quoteId'] }

    const noKey = await send('POST', `/visits/${visit.id}:checkout`, { body })
    const therapistQuote = await send('POST', `/visits/${visit.id}:quote-checkout`, { as: therapist, body: {} })
    const negative = await send('POST', `/visits/${visit.id}:quote-checkout`, {
      body: { payments: [{ method: 'CASH', amount: { taxable: -1, taxExempt: 0 } }] },
    })
    const extra = await send('POST', `/visits/${visit.id}:checkout`, { key: 'x', body: { ...body, total: 0 } })
    const otherEncounter = await send('POST', `/visits/${visit.id}:quote-checkout`, {
      body: { encounterIds: ['enc_01JBQ000000000000000000099'] },
    })
    const foreign = await send('POST', `/visits/${visit.id}:quote-checkout`, { as: elsewhere, body: {} })

    expect(noKey.status).toBe(400)
    expect(therapistQuote.status).toBe(403)
    expect(negative.status).toBe(400)
    expect(extra.status).toBe(400)
    expect(otherEncounter.status).toBe(422)
    expect(await json(otherEncounter)).toMatchObject({
      code: 'CHECKOUT_ENCOUNTER_INVALID',
      encounterIds: ['enc_01JBQ000000000000000000099'],
    })
    expect(foreign.status).toBe(404)
  })
})
