import { rejected, success } from '../../../shared/decision/testing.ts'
import { describe, expect, it } from 'vitest'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { testVisit } from '../visits/testing.ts'
import type { Visit } from '../visits/visit.ts'
import { decideCheckout } from './checkout.aggregate.ts'
import type { CheckoutCommand, CheckoutFacts } from './checkout.aggregate.ts'
import { selectDues } from './receipt.aggregate.ts'
import { quoteIdOf } from './receipt-charges.ts'
import { TEST_CONTEXT, TEST_RECEIPT_IDS, testEncounter, testPayment, testReceipt } from './testing.ts'

/**
 * 수납 판정 함수의 테스트입니다. given(내원과 미리 읽은 사실) / when(수납 커맨드) / then(완료한 내원과 새 영수증, 또는
 * 거부)으로 씁니다. 저장·권한·동시성은 서비스 테스트(`receipts.test.ts`)가 봅니다.
 */

const visit = (overrides: Partial<Visit> = {}) => testVisit({ status: 'IN_TREATMENT', ...overrides })

const facts = (overrides: Partial<CheckoutFacts> = {}): CheckoutFacts => ({
  activeReceipt: null,
  encounters: [testEncounter(10_000)],
  birthDate: null,
  requestedPayments: [],
  ...overrides,
})

/** 지금 진료로 계산한 견적 ID입니다. */
const quoteOf = (given: Visit, encounters = facts().encounters): Id<'quote'> =>
  quoteIdOf(success(selectDues(given, encounters, null, undefined)).dues)

const cash = (amount: number) => ({ method: 'CASH' as const, amount: { taxable: 0, taxExempt: amount } })

describe('decideCheckout', () => {
  it('견적대로 현금을 다 받으면 내원을 완료하고 완납 영수증과 새 결제, 영수증 생성 이벤트를 냅니다', () => {
    const given = visit({ version: 2 })
    const command: CheckoutCommand = { quoteId: quoteOf(given), payments: [cash(10_000)], memo: '현금' }

    const then = success(decideCheckout(given, command, facts(), TEST_RECEIPT_IDS, TEST_CONTEXT))

    expect(then.visit.visit).toMatchObject({ status: 'COMPLETED', version: 3 })
    expect(then.visit.events.map((each) => each.type)).toEqual(['visit.status_changed'])
    const [paymentId] = TEST_RECEIPT_IDS.paymentIds(1)
    expect(then.receipt.receipt).toMatchObject({
      id: TEST_RECEIPT_IDS.receiptId,
      visitId: given.id,
      date: TEST_CONTEXT.today,
      memo: '현금',
      quoteId: command.quoteId,
      charges: { total: 10_000 },
      settlement: { result: 'PAID', outstanding: 0 },
      correctionOf: null,
      payments: [{ id: paymentId, method: 'CASH' }],
    })
    expect(then.receipt.changes.insertPayments).toMatchObject([
      { id: paymentId, receiptId: TEST_RECEIPT_IDS.receiptId, status: 'CAPTURED', version: 1 },
    ])
    expect(then.receipt.event).toMatchObject({
      type: 'receipt.created',
      subject: TEST_RECEIPT_IDS.receiptId,
      data: { total: 10_000, result: 'PAID', paymentIds: [paymentId], correctionOf: null },
    })
  })

  it('미리 기록한 카드 결제를 적용하면 그 결제를 이 영수증의 받은 결제로 옮기고 새 결제는 만들지 않습니다', () => {
    const given = visit()
    const card = testPayment({ method: 'CARD', status: 'UNAPPLIED', receiptId: null, visitId: null, version: 1 })
    const command: CheckoutCommand = { quoteId: quoteOf(given), paymentIds: [card.id] }

    const then = success(
      decideCheckout(given, command, facts({ requestedPayments: [card] }), TEST_RECEIPT_IDS, TEST_CONTEXT),
    )

    expect(then.receipt.changes.insertPayments).toEqual([])
    expect(then.receipt.changes.updatePayments).toMatchObject([
      {
        payment: {
          id: card.id,
          receiptId: TEST_RECEIPT_IDS.receiptId,
          visitId: given.id,
          status: 'CAPTURED',
          version: 2,
        },
        expectedVersion: 1,
      },
    ])
  })

  it('견적 뒤에 금액이 바뀌었으면 지금 견적 ID를 담아 거부합니다', () => {
    const given = visit()
    const stale = quoteOf(given)
    const changed = facts({ encounters: [testEncounter(12_000)] })

    rejected(
      decideCheckout(given, { quoteId: stale, payments: [cash(12_000)] }, changed, TEST_RECEIPT_IDS, TEST_CONTEXT),
      { _tag: 'QuoteStale', quoteId: quoteOf(given, changed.encounters) },
    )
  })

  it.each(['COMPLETED', 'CANCELED'] as const)('%s 내원은 금액을 보기 전에 거부합니다', (status) => {
    const given = visit({ status })

    rejected(decideCheckout(given, { quoteId: quoteOf(given) }, facts(), TEST_RECEIPT_IDS, TEST_CONTEXT), {
      _tag: 'VisitTransitionInvalid',
      currentStatus: status,
      command: 'CHECKOUT',
    })
  })

  it('다시 열었지만 유효한 영수증이 남은 내원은 그 영수증을 담아 거부합니다', () => {
    const given = visit()
    const active = testReceipt()

    rejected(
      decideCheckout(
        given,
        { quoteId: quoteOf(given) },
        facts({ activeReceipt: active }),
        TEST_RECEIPT_IDS,
        TEST_CONTEXT,
      ),
      { _tag: 'ReceiptAlreadyExists', receiptId: active.id },
    )
  })

  it('다른 환자의 미리 기록한 결제는 적용하지 않고 그 결제를 담아 거부합니다', () => {
    const given = visit()
    const others = testPayment({
      status: 'UNAPPLIED',
      receiptId: null,
      visitId: null,
      patientId: 'pat_01JBQ000000000000000000002' as Id<'patient'>,
    })

    rejected(
      decideCheckout(
        given,
        { quoteId: quoteOf(given), paymentIds: [others.id] },
        facts({ requestedPayments: [others] }),
        TEST_RECEIPT_IDS,
        TEST_CONTEXT,
      ),
      { _tag: 'CheckoutPaymentInvalid', paymentIds: [others.id] },
    )
  })

  it('밖에서 승인되는 카드를 수납 요청의 결제로 보내면 결산 오류로 거부합니다', () => {
    const given = visit()
    const card = { method: 'CARD' as const, amount: { taxable: 0, taxExempt: 10_000 } }

    rejected(
      decideCheckout(given, { quoteId: quoteOf(given), payments: [card] }, facts(), TEST_RECEIPT_IDS, TEST_CONTEXT),
      { _tag: 'CheckoutRejected', errors: ['PAYMENT_METHOD_NOT_ALLOWED'], warnings: [] },
    )
  })

  it('한 푼도 받지 않고 미수를 확인받지 않으면 미수 경고로 거부하고, 확인받으면 미수 영수증을 만듭니다', () => {
    const given = visit()

    rejected(decideCheckout(given, { quoteId: quoteOf(given) }, facts(), TEST_RECEIPT_IDS, TEST_CONTEXT), {
      _tag: 'CheckoutRejected',
      errors: [],
      warnings: ['OUTSTANDING'],
    })
    const accepted = success(
      decideCheckout(
        given,
        { quoteId: quoteOf(given), acknowledge: ['OUTSTANDING'] },
        facts(),
        TEST_RECEIPT_IDS,
        TEST_CONTEXT,
      ),
    )

    expect(accepted.receipt.receipt.settlement).toMatchObject({
      result: 'OUTSTANDING',
      outstanding: 10_000,
      acknowledged: ['OUTSTANDING'],
    })
  })
})
