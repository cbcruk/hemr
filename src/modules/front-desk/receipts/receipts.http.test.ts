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

  it('locks the billed prescription and the quote, then voids the receipt with a cascade cancel', async () => {
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
    const requote = await send('POST', `/visits/${visit.id}:quote-checkout`, { body: {} })
    const cascade = await send('POST', `/visits/${visit.id}:cancel`, {
      as: doctor,
      body: { reason: '잘못 접수', cascade: true },
    })

    expect((checkedOut['receipt'] as Body)['payments']).toHaveLength(1)
    expect(lines.status).toBe(409)
    expect(await json(lines)).toMatchObject({ code: 'ENCOUNTER_BILLED', receiptId })
    expect(note.status).toBe(200)
    expect(retract.status).toBe(409)
    expect(await json(retract)).toMatchObject({ code: 'ENCOUNTER_BILLED', receiptId })
    expect(requote.status).toBe(409)
    expect(await json(requote)).toMatchObject({ code: 'VISIT_TRANSITION_INVALID', currentStatus: 'COMPLETED' })
    // 현금 결제만 있어 연쇄 취소가 영수증과 결제를 함께 취소합니다
    expect(cascade.status).toBe(200)
    expect(await json(cascade)).toMatchObject({ status: 'CANCELED' })
    expect(await json(await send('GET', `/receipts/${receiptId}`))).toMatchObject({
      status: 'VOIDED',
      voided: { reason: '잘못 접수', by: doctor.user.id, correctedBy: null },
      payments: [{ method: 'CASH', status: 'VOIDED' }],
    })
  })

  it('records a terminal payment first and applies it at checkout', async () => {
    const send = app(store)
    const { visit } = await charted(send, 30_000)
    const card = {
      patientId: visit['patientId'],
      visitId: visit.id,
      method: 'CARD',
      amount: { taxable: 0, taxExempt: 20_000 },
      processorRef: '30012345',
    }
    const recorded = await send('POST', '/payments', { key: 'p1', body: card })
    const payment = await json(recorded)
    const replayed = await json(await send('POST', '/payments', { key: 'p1', body: card }))
    const reused = await send('POST', '/payments', { key: 'p1', body: { ...card, processorRef: '30099999' } })
    const quote = await json(
      await send('POST', `/visits/${visit.id}:quote-checkout`, { body: { paymentIds: [payment.id] } }),
    )
    // 같은 키를 다른 커맨드에 쓰면 본문과 상관없이 다른 요청입니다
    const crossed = await send('POST', `/visits/${visit.id}:checkout`, {
      key: 'p1',
      body: { quoteId: quote['quoteId'], paymentIds: [payment.id], payments: [cash(10_000)] },
    })
    const stale = await send('POST', `/visits/${visit.id}:checkout`, {
      key: 's',
      body: { quoteId: 'qt_00000000000000000000000000', paymentIds: [payment.id], payments: [cash(10_000)] },
    })
    const stillUnapplied = await json(await send('GET', `/payments/${payment.id}`))
    const checkedOut = await json(
      await send('POST', `/visits/${visit.id}:checkout`, {
        key: 'c',
        body: { quoteId: quote['quoteId'], paymentIds: [payment.id, payment.id], payments: [cash(10_000)] },
      }),
    )
    const captured = await json(await send('GET', `/payments/${payment.id}`))
    const receipt = checkedOut['receipt'] as Body

    expect(recorded.status).toBe(200)
    expect(payment).toMatchObject({
      id: expect.stringMatching(/^pay_/),
      patientId: visit['patientId'],
      visitId: visit.id,
      receiptId: null,
      method: 'CARD',
      amount: { taxable: 0, taxExempt: 20_000 },
      processorRef: '30012345',
      status: 'UNAPPLIED',
      recordedBy: desk.user.id,
      version: 1,
    })
    expect(replayed).toEqual(payment)
    expect(reused.status).toBe(422)
    expect(await json(reused)).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
    expect(crossed.status).toBe(422)
    expect(await json(crossed)).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
    expect(quote).toMatchObject({
      settlement: { entered: { taxable: 0, taxExempt: 20_000 }, remaining: 10_000, result: 'OUTSTANDING' },
      errors: [],
      warnings: [],
    })
    expect(stale.status).toBe(409)
    expect(stillUnapplied).toMatchObject({ status: 'UNAPPLIED', receiptId: null })
    expect(receipt).toMatchObject({
      payments: [
        { id: payment.id, method: 'CARD', processorRef: '30012345', amount: { taxExempt: 20_000 } },
        { method: 'CASH', processorRef: null, amount: { taxExempt: 10_000 } },
      ],
      settlement: { result: 'PAID', received: { taxable: 0, taxExempt: 30_000 } },
    })
    expect(captured).toMatchObject({ status: 'CAPTURED', receiptId: receipt.id, version: 2 })
  })

  it('refuses payments of another patient, visit or tenant and payments already applied', async () => {
    const send = app(store)
    const first = await charted(send, 10_000)
    const second = await charted(send, 10_000)
    const third = await charted(send, 10_000)
    const record = async (patientId: unknown, visitId: string | undefined, key: string) =>
      json(
        await send('POST', '/payments', {
          key,
          body: {
            patientId,
            ...(visitId === undefined ? {} : { visitId }),
            method: 'KAKAO_PAY',
            amount: { taxable: 0, taxExempt: 10_000 },
            processorRef: key,
          },
        }),
      )
    const forFirst = await record(first.visit['patientId'], first.visit.id, 'a')
    const ofSecond = await record(second.visit['patientId'], undefined, 'b')
    const anyVisit = await record(third.visit['patientId'], undefined, 'c')
    const quoteOf = async (id: string, paymentIds: string[]) =>
      send('POST', `/visits/${id}:quote-checkout`, { body: { paymentIds } })

    const otherVisit = await quoteOf(second.visit.id, [forFirst.id, ofSecond.id])
    const missing = await quoteOf(second.visit.id, ['pay_01JBQ000000000000000000099'])
    const quote = await json(await quoteOf(third.visit.id, [anyVisit.id]))
    const checkedOut = await send('POST', `/visits/${third.visit.id}:checkout`, {
      key: 'k',
      body: { quoteId: quote['quoteId'], paymentIds: [anyVisit.id] },
    })
    const twice = await quoteOf(first.visit.id, [anyVisit.id])
    const mismatch = await send('POST', '/payments', {
      key: 'm',
      body: {
        patientId: first.visit['patientId'],
        visitId: second.visit.id,
        method: 'CARD',
        amount: { taxable: 0, taxExempt: 1 },
        processorRef: 'x',
      },
    })
    const noPatient = await send('POST', '/payments', {
      key: 'n',
      body: {
        patientId: 'pat_01JBQ000000000000000000099',
        method: 'CARD',
        amount: { taxable: 0, taxExempt: 1 },
        processorRef: 'x',
      },
    })
    const foreign = await send('GET', `/payments/${forFirst.id}`, { as: elsewhere })
    const foreignQuote = await send('POST', `/visits/${first.visit.id}:quote-checkout`, {
      as: elsewhere,
      body: { paymentIds: [forFirst.id] },
    })

    expect(otherVisit.status).toBe(422)
    expect(await json(otherVisit)).toMatchObject({
      code: 'CHECKOUT_PAYMENT_INVALID',
      paymentIds: [forFirst.id],
    })
    expect(missing.status).toBe(422)
    expect(checkedOut.status).toBe(200)
    expect(twice.status).toBe(422)
    expect(await json(twice)).toMatchObject({ code: 'CHECKOUT_PAYMENT_INVALID', paymentIds: [anyVisit.id] })
    expect(mismatch.status).toBe(422)
    expect(await json(mismatch)).toMatchObject({ code: 'PAYMENT_VISIT_MISMATCH' })
    expect(noPatient.status).toBe(404)
    expect(await json(noPatient)).toMatchObject({ code: 'PATIENT_NOT_FOUND' })
    expect(foreign.status).toBe(404)
    expect(await json(foreign)).toMatchObject({ code: 'PAYMENT_NOT_FOUND' })
    expect(foreignQuote.status).toBe(404)
  })

  it('checks permissions and payloads of recorded payments', async () => {
    const send = app(store)
    const { visit } = await charted(send)
    const body = {
      patientId: visit['patientId'],
      method: 'CARD',
      amount: { taxable: 0, taxExempt: 1_000 },
      processorRef: '1',
    }

    const noKey = await send('POST', '/payments', { body })
    const therapistRecord = await send('POST', '/payments', { as: therapist, key: 't', body })
    const zero = await send('POST', '/payments', { key: 'z', body: { ...body, amount: { taxable: 0, taxExempt: 0 } } })
    const cashMethod = await send('POST', '/payments', { key: 'c', body: { ...body, method: 'CASH' } })
    const blankRef = await send('POST', '/payments', { key: 'b', body: { ...body, processorRef: ' ' } })
    const extra = await send('POST', '/payments', { key: 'e', body: { ...body, status: 'CAPTURED' } })
    const payment = await json(await send('POST', '/payments', { key: 'ok', body }))
    const therapistRead = await send('GET', `/payments/${payment.id}`, { as: therapist })

    expect(noKey.status).toBe(400)
    expect(therapistRecord.status).toBe(403)
    expect(zero.status).toBe(400)
    expect(cashMethod.status).toBe(400)
    expect(blankRef.status).toBe(400)
    expect(extra.status).toBe(400)
    expect(payment).toMatchObject({ visitId: null, status: 'UNAPPLIED' })
    expect(therapistRead.status).toBe(403)
  })

  /** 카드 결제를 먼저 기록하고 현금과 함께 수납해, 영수증·카드 결제 ID를 돌려줍니다. */
  async function paidWithCard(
    send: ReturnType<typeof app>,
    card: number,
    cashAmount: number,
    extra: Record<string, unknown> = {},
  ) {
    const charted_ = await charted(send, card + cashAmount)
    const { visit } = charted_
    const payment = await json(
      await send('POST', '/payments', {
        key: `card-${visit.id}`,
        body: {
          patientId: visit['patientId'],
          visitId: visit.id,
          method: 'CARD',
          amount: { taxable: 0, taxExempt: card },
          processorRef: '1',
        },
      }),
    )
    const body = { paymentIds: [payment.id], payments: cashAmount === 0 ? [] : [cash(cashAmount)] }
    const quote = await json(await send('POST', `/visits/${visit.id}:quote-checkout`, { body }))
    const checkedOut = await send('POST', `/visits/${visit.id}:checkout`, {
      key: `checkout-${visit.id}`,
      body: { ...body, ...extra, quoteId: quote['quoteId'] },
    })
    expect(checkedOut.status).toBe(200)
    return { ...charted_, cardId: payment.id, receipt: (await json(checkedOut))['receipt'] as Body }
  }

  it('lists receipts by date and patient a page at a time', async () => {
    const send = app(store)
    const first = await paidWithCard(send, 1_000, 0)
    const second = await paidWithCard(send, 2_000, 0)
    const date = first.receipt['date'] as string

    const page = await json(await send('GET', `/receipts?date=${date}&limit=1`))
    const next = await json(await send('GET', `/receipts?date=${date}&limit=1&cursor=${page['nextCursor'] as string}`))
    const byPatient = await json(await send('GET', `/receipts?patientId=${second.visit['patientId'] as string}`))
    const otherDay = await json(await send('GET', '/receipts?date=2000-01-01'))
    const badCursor = await send('GET', '/receipts?cursor=rcp_01JBQ000000000000000000099')
    const one = await json(await send('GET', `/receipts/${first.receipt.id}`))
    const foreign = await send('GET', `/receipts/${first.receipt.id}`, { as: elsewhere })
    const therapistList = await send('GET', '/receipts', { as: therapist })

    expect((page['items'] as Body[]).map((each) => each.id)).toEqual([first.receipt.id])
    expect((next['items'] as Body[]).map((each) => each.id)).toEqual([second.receipt.id])
    expect(next['nextCursor']).toBeNull()
    expect((byPatient['items'] as Body[]).map((each) => each.id)).toEqual([second.receipt.id])
    expect(otherDay['items']).toEqual([])
    expect(badCursor.status).toBe(400)
    expect(one).toEqual(first.receipt)
    expect(foreign.status).toBe(404)
    expect(await json(foreign)).toMatchObject({ code: 'RECEIPT_NOT_FOUND' })
    expect(therapistList.status).toBe(403)
  })

  it('refunds a payment within its method and amount and settles the receipt again', async () => {
    const send = app(store)
    const { receipt, cardId } = await paidWithCard(send, 20_000, 0)
    const refund = (key: string, body: Record<string, unknown>) =>
      send('POST', `/payments/${cardId}:refund`, { key, body: { reason: '환불', ...body } })

    const wrongMethod = await refund('a', { amount: { taxable: 0, taxExempt: 1_000 }, refundMethod: 'CASH' })
    const tooMuch = await refund('b', { amount: { taxable: 1, taxExempt: 0 }, refundMethod: 'CARD_CANCEL' })
    const partial = await json(
      await refund('c', { amount: { taxable: 0, taxExempt: 5_000 }, refundMethod: 'CARD_CANCEL' }),
    )
    const replayed = await json(
      await refund('c', { amount: { taxable: 0, taxExempt: 5_000 }, refundMethod: 'CARD_CANCEL' }),
    )
    const afterPartial = await json(await send('GET', `/receipts/${receipt.id}`))
    const rest = await json(
      await refund('d', { amount: { taxable: 0, taxExempt: 15_000 }, refundMethod: 'CARD_CANCEL', writeOff: true }),
    )
    const afterRest = await json(await send('GET', `/receipts/${receipt.id}`))
    const again = await refund('e', { amount: { taxable: 0, taxExempt: 1 }, refundMethod: 'CARD_CANCEL' })

    expect(wrongMethod.status).toBe(422)
    expect(await json(wrongMethod)).toMatchObject({
      code: 'REFUND_REJECTED',
      errors: ['METHOD_NOT_ALLOWED'],
      allowedMethods: ['CARD_CANCEL'],
      refundable: { taxable: 0, taxExempt: 20_000 },
    })
    expect(tooMuch.status).toBe(422)
    expect(await json(tooMuch)).toMatchObject({ errors: ['AMOUNT_EXCEEDED'] })
    expect(partial).toMatchObject({
      status: 'PARTIALLY_REFUNDED',
      refunds: [{ amount: { taxable: 0, taxExempt: 5_000 }, method: 'CARD_CANCEL', writtenOff: 0, by: desk.user.id }],
      version: 3,
    })
    expect(replayed).toEqual(partial)
    expect(afterPartial).toMatchObject({
      payments: [{ id: cardId, status: 'PARTIALLY_REFUNDED', refunded: { taxable: 0, taxExempt: 5_000 } }],
      settlement: { received: { taxable: 0, taxExempt: 15_000 }, result: 'OUTSTANDING', outstanding: 5_000 },
      version: 2,
    })
    expect(rest).toMatchObject({ status: 'REFUNDED' })
    // 손비 환불은 늘어난 남은 금액을 미수 대신 손비로 둡니다
    expect(afterRest).toMatchObject({
      settlement: { result: 'OUTSTANDING', outstanding: 5_000, writtenOff: 15_000 },
    })
    expect(again.status).toBe(409)
    expect(await json(again)).toMatchObject({ code: 'PAYMENT_NOT_REFUNDABLE', paymentStatus: 'REFUNDED' })
  })

  it('refunds an unapplied payment only in full and lists unapplied payments', async () => {
    const send = app(store)
    const { visit } = await charted(send, 1_000)
    const record = async (key: string) =>
      json(
        await send('POST', '/payments', {
          key,
          body: {
            patientId: visit['patientId'],
            method: 'KAKAO_PAY',
            amount: { taxable: 0, taxExempt: 3_000 },
            processorRef: key,
          },
        }),
      )
    const kept = await record('kept')
    const returned = await record('returned')

    const partial = await send('POST', `/payments/${returned.id}:refund`, {
      key: 'p',
      body: { amount: { taxable: 0, taxExempt: 1_000 }, refundMethod: 'KAKAO_PAY', reason: '취소' },
    })
    const full = await json(
      await send('POST', `/payments/${returned.id}:refund`, {
        key: 'f',
        body: { amount: { taxable: 0, taxExempt: 3_000 }, refundMethod: 'CASH', reason: '취소', writeOff: true },
      }),
    )
    const unapplied = await json(
      await send('GET', `/payments?status=UNAPPLIED&patientId=${visit['patientId'] as string}`),
    )
    const apply = await send('POST', `/visits/${visit.id}:quote-checkout`, { body: { paymentIds: [returned.id] } })

    expect(partial.status).toBe(422)
    expect(await json(partial)).toMatchObject({ errors: ['PARTIAL_UNAPPLIED'] })
    // 미적용 결제는 영수증이 없어 손비가 뜻이 없습니다
    expect(full).toMatchObject({ status: 'REFUNDED', receiptId: null, refunds: [{ method: 'CASH', writtenOff: 0 }] })
    expect((unapplied['items'] as Body[]).map((each) => each.id)).toEqual([kept.id])
    expect(apply.status).toBe(422)
    expect(await json(apply)).toMatchObject({ code: 'CHECKOUT_PAYMENT_INVALID' })
  })

  it('voids a receipt only after terminal payments are refunded, then checks out again', async () => {
    const send = app(store)
    const { visit, encounterId, receipt, cardId } = await paidWithCard(send, 4_000, 6_000)

    const blocked = await send('POST', `/receipts/${receipt.id}:void`, { body: { reason: '잘못 입력' } })
    const cascade = await send('POST', `/visits/${visit.id}:cancel`, {
      as: doctor,
      body: { reason: '잘못 접수', cascade: true },
    })
    await send('POST', `/payments/${cardId}:refund`, {
      key: 'r',
      body: { amount: { taxable: 0, taxExempt: 4_000 }, refundMethod: 'CARD_CANCEL', reason: '잘못 입력' },
    })
    const voided = await send('POST', `/receipts/${receipt.id}:void`, { body: { reason: '잘못 입력' } })
    const twice = await send('POST', `/receipts/${receipt.id}:void`, { body: { reason: '잘못 입력' } })
    const lines = await send('PATCH', `/encounters/${encounterId}`, {
      as: doctor,
      ifMatch: '"2"',
      body: { prescriptionLines: { upsert: [nonbenefit(1_000)] } },
    })
    await send('POST', `/visits/${visit.id}:reopen`, { body: { reason: '다시 수납' } })
    const quote = await json(await send('POST', `/visits/${visit.id}:quote-checkout`, { body: {} }))
    const again = await send('POST', `/visits/${visit.id}:checkout`, {
      key: 'again',
      body: { quoteId: quote['quoteId'], payments: [cash(11_000)] },
    })

    expect(blocked.status).toBe(409)
    expect(await json(blocked)).toMatchObject({
      code: 'PAYMENT_REFUND_REQUIRED',
      receiptId: receipt.id,
      paymentIds: [cardId],
    })
    expect(cascade.status).toBe(409)
    expect(await json(cascade)).toMatchObject({ code: 'PAYMENT_REFUND_REQUIRED', paymentIds: [cardId] })
    expect(voided.status).toBe(200)
    expect(await json(voided)).toMatchObject({
      status: 'VOIDED',
      voided: { reason: '잘못 입력', by: desk.user.id, correctedBy: null },
      payments: [
        { id: cardId, status: 'REFUNDED' },
        { method: 'CASH', status: 'VOIDED' },
      ],
      // 카드 환불이 결산을 다시 써 한 번, 취소가 한 번 올렸습니다
      version: 3,
    })
    expect(twice.status).toBe(409)
    expect(await json(twice)).toMatchObject({ code: 'RECEIPT_VOIDED' })
    // 취소한 영수증은 처방을 잠그지 않습니다
    expect(lines.status).toBe(200)
    expect(again.status).toBe(200)
  })

  it('corrects a receipt by moving terminal payments and taking in-server payments again', async () => {
    const send = app(store)
    const { visit, receipt, cardId } = await paidWithCard(send, 4_000, 6_000)
    const body = {
      payments: [{ method: 'BANK_TRANSFER', amount: { taxable: 0, taxExempt: 6_000 } }],
      reason: '수단 정정',
    }

    const corrected = await send('POST', `/receipts/${receipt.id}:correct`, { key: 'c', body })
    const replacement = await json(corrected)
    const replayed = await json(await send('POST', `/receipts/${receipt.id}:correct`, { key: 'c', body }))
    const old = await json(await send('GET', `/receipts/${receipt.id}`))
    const card = await json(await send('GET', `/payments/${cardId}`))
    const visitNow = await json(await send('GET', `/visits/${visit.id}`))
    const twice = await send('POST', `/receipts/${receipt.id}:correct`, { key: 'c2', body })
    const short = await send('POST', `/receipts/${replacement.id}:correct`, {
      key: 's',
      body: { reason: '현금 빼기' },
    })

    expect(corrected.status).toBe(200)
    expect(replacement).toMatchObject({
      id: expect.stringMatching(/^rcp_/),
      visitId: visit.id,
      correctionOf: receipt.id,
      encounterIds: receipt['encounterIds'],
      charges: receipt['charges'],
      payments: [
        { id: cardId, method: 'CARD', status: 'CAPTURED' },
        { method: 'BANK_TRANSFER', status: 'CAPTURED', amount: { taxable: 0, taxExempt: 6_000 } },
      ],
      settlement: { result: 'PAID' },
      status: 'ACTIVE',
      voided: null,
    })
    expect(replayed).toEqual(replacement)
    expect(old).toMatchObject({
      status: 'VOIDED',
      voided: { reason: '수단 정정', correctedBy: replacement.id },
      payments: [{ method: 'CASH', status: 'VOIDED' }],
    })
    expect(card).toMatchObject({ receiptId: replacement.id, status: 'CAPTURED' })
    expect(visitNow).toMatchObject({ status: 'COMPLETED' })
    expect(twice.status).toBe(409)
    expect(await json(twice)).toMatchObject({ code: 'RECEIPT_VOIDED' })
    // 옮긴 카드 결제가 있어 미수 확인 없이 미수로 남습니다
    expect(short.status).toBe(200)
    expect(await json(short)).toMatchObject({ settlement: { result: 'OUTSTANDING', outstanding: 6_000 } })
  })

  it('corrects a partially refunded card at its net amount and keeps memo and flags unless changed', async () => {
    const send = app(store)
    const { receipt, cardId } = await paidWithCard(send, 6_000, 4_000, { memo: '메모', excludeFromTaxDeduction: true })
    await send('POST', `/payments/${cardId}:refund`, {
      key: 'r1',
      body: { amount: { taxable: 0, taxExempt: 2_000 }, refundMethod: 'CARD_CANCEL', reason: '일부 취소' },
    })
    const external = await send('POST', `/receipts/${receipt.id}:correct`, {
      key: 'x',
      body: { reason: '정정', payments: [{ method: 'CARD', amount: { taxable: 0, taxExempt: 6_000 } }] },
    })
    const replacement = await json(
      await send('POST', `/receipts/${receipt.id}:correct`, {
        key: 'c',
        body: { reason: '정정', payments: [{ method: 'BANK_TRANSFER', amount: { taxable: 0, taxExempt: 6_000 } }] },
      }),
    )
    const later = await json(
      await send('POST', `/payments/${cardId}:refund`, {
        key: 'r2',
        body: { amount: { taxable: 0, taxExempt: 4_000 }, refundMethod: 'CARD_CANCEL', reason: '나머지 취소' },
      }),
    )
    const afterLater = await json(await send('GET', `/receipts/${replacement.id}`))
    const changed = await json(
      await send('POST', `/receipts/${replacement.id}:correct`, {
        key: 'c2',
        body: { reason: '공제 포함', memo: '', excludeFromTaxDeduction: false, acknowledge: ['OUTSTANDING'] },
      }),
    )

    expect(external.status).toBe(422)
    expect(await json(external)).toMatchObject({ code: 'CHECKOUT_REJECTED', errors: ['PAYMENT_METHOD_NOT_ALLOWED'] })
    // 카드는 환불하고 남은 4,000원으로 결산에 들어갑니다
    expect(replacement).toMatchObject({
      memo: '메모',
      flags: { excludeFromTaxDeduction: true },
      payments: [
        { id: cardId, status: 'PARTIALLY_REFUNDED', refunded: { taxable: 0, taxExempt: 2_000 } },
        { method: 'BANK_TRANSFER' },
      ],
      settlement: { received: { taxable: 0, taxExempt: 10_000 }, result: 'PAID' },
    })
    expect(later).toMatchObject({ status: 'REFUNDED', receiptId: replacement.id })
    expect(afterLater).toMatchObject({
      settlement: { received: { taxable: 0, taxExempt: 6_000 }, result: 'OUTSTANDING', outstanding: 4_000 },
    })
    expect(changed).toMatchObject({ memo: '', flags: { excludeFromTaxDeduction: false } })
  })

  it('checks permissions of refund, void and correct and writes nothing when a cascade cancel is blocked', async () => {
    const send = app(store)
    const { visit, receipt, cardId } = await paidWithCard(send, 1_000, 0)
    const refund = await send('POST', `/payments/${cardId}:refund`, {
      as: therapist,
      key: 'r',
      body: { amount: { taxable: 0, taxExempt: 1 }, refundMethod: 'CARD_CANCEL', reason: '환불' },
    })
    const voided = await send('POST', `/receipts/${receipt.id}:void`, { as: therapist, body: { reason: '취소' } })
    const corrected = await send('POST', `/receipts/${receipt.id}:correct`, {
      as: therapist,
      key: 'c',
      body: { reason: '정정' },
    })
    const reused = await send('POST', `/payments/${cardId}:refund`, {
      key: 'same',
      body: { amount: { taxable: 0, taxExempt: 1 }, refundMethod: 'CARD_CANCEL', reason: '환불' },
    })
    const reusedDifferent = await send('POST', `/payments/${cardId}:refund`, {
      key: 'same',
      body: { amount: { taxable: 0, taxExempt: 2 }, refundMethod: 'CARD_CANCEL', reason: '환불' },
    })
    const cascade = await send('POST', `/visits/${visit.id}:cancel`, {
      as: doctor,
      body: { reason: '잘못 접수', cascade: true },
    })

    expect([refund.status, voided.status, corrected.status]).toEqual([403, 403, 403])
    expect(reused.status).toBe(200)
    expect(reusedDifferent.status).toBe(422)
    expect(await json(reusedDifferent)).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
    expect(cascade.status).toBe(409)
    expect(await json(await send('GET', `/visits/${visit.id}`))).toMatchObject({ status: 'COMPLETED' })
    expect(await json(await send('GET', `/receipts/${receipt.id}`))).toMatchObject({ status: 'ACTIVE' })
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
