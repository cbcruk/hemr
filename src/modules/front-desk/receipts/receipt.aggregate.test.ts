import { describe, expect, it } from 'vitest'
import { testVisit } from '../visits/testing.ts'
import { decideCorrection, decideVoid } from './receipt.aggregate.ts'
import type { CorrectionFacts } from './receipt.aggregate.ts'
import { failure, success, TEST_CONTEXT, TEST_RECEIPT_IDS, testEncounter, testPayment, testReceipt } from './testing.ts'

/**
 * 수납 취소·정정 판정 함수의 테스트입니다. given(영수증과 그 결제) / when(커맨드) / then(취소한 영수증·결제와 새
 * 영수증, 또는 거부)으로 씁니다. 저장·권한·동시성은 서비스 테스트(`receipts.test.ts`)가 봅니다.
 */

const encounter = testEncounter(10_000)
const receipt = testReceipt({ encounterIds: [encounter.id], version: 2 })
const card = testPayment({ method: 'CARD', processorRef: 'APPROVAL-1' })

const facts = (overrides: Partial<CorrectionFacts> = {}): CorrectionFacts => ({
  payments: [testPayment()],
  visit: testVisit({ status: 'COMPLETED' }),
  encounters: [encounter],
  birthDate: null,
  requestedPayments: [],
  ...overrides,
})

describe('decideVoid', () => {
  it('현금으로 받은 영수증을 취소하면 영수증과 결제를 취소하고 영수증 취소 이벤트를 냅니다', () => {
    const cash = testPayment()

    const then = success(decideVoid(receipt, [cash], { reason: '잘못 수납' }, TEST_CONTEXT))

    expect(then.receipt).toMatchObject({
      status: 'VOIDED',
      voided: { at: TEST_CONTEXT.at, by: TEST_CONTEXT.userId, reason: '잘못 수납', correctedBy: null },
      version: 3,
    })
    expect(then.expectedVersion).toBe(2)
    expect(then.voided).toMatchObject([{ id: cash.id, status: 'VOIDED', version: cash.version + 1 }])
    expect(then.carried).toEqual([])
    expect(then.event).toMatchObject({
      type: 'receipt.voided',
      subject: receipt.id,
      data: { receiptId: receipt.id, date: receipt.date, reason: '잘못 수납', correctedBy: null },
    })
  })

  it('밖에서 취소해야 하는 카드 결제가 남았으면 그 결제를 담아 거부합니다', () => {
    const then = failure(decideVoid(receipt, [card], { reason: '잘못 수납' }, TEST_CONTEXT))

    expect(then).toMatchObject({ _tag: 'PaymentRefundRequired', receiptId: receipt.id, paymentIds: [card.id] })
  })

  it('카드 결제를 이미 전액 환불했으면 취소합니다', () => {
    const refunded = { ...card, status: 'REFUNDED' as const }

    const then = success(decideVoid(receipt, [refunded], { reason: '환불 뒤 취소' }, TEST_CONTEXT))

    expect(then.receipt.status).toBe('VOIDED')
    expect(then.voided).toEqual([])
  })

  it('이미 취소한 영수증은 거부합니다', () => {
    const voided = success(decideVoid(receipt, [], { reason: '잘못 수납' }, TEST_CONTEXT)).receipt

    expect(failure(decideVoid(voided, [], { reason: '다시' }, TEST_CONTEXT))._tag).toBe('ReceiptVoided')
  })
})

describe('decideCorrection', () => {
  it('카드 결제를 정정하면 환불하지 않고 새 영수증으로 옮기며, 앞 영수증의 메모·소득공제 제외를 이어받습니다', () => {
    const given = { ...receipt, memo: '원래 메모', flags: { excludeFromTaxDeduction: true } }

    const then = success(
      decideCorrection(given, { reason: '수단 정정' }, facts({ payments: [card] }), TEST_RECEIPT_IDS, TEST_CONTEXT),
    )

    expect(then.voided.receipt).toMatchObject({
      status: 'VOIDED',
      voided: { correctedBy: TEST_RECEIPT_IDS.receiptId },
    })
    expect(then.voided.voided).toEqual([])
    expect(then.created.receipt).toMatchObject({
      id: TEST_RECEIPT_IDS.receiptId,
      correctionOf: given.id,
      encounterIds: given.encounterIds,
      memo: '원래 메모',
      flags: { excludeFromTaxDeduction: true },
      settlement: { result: 'PAID' },
    })
    expect(then.created.changes.updatePayments).toMatchObject([
      {
        payment: { id: card.id, receiptId: TEST_RECEIPT_IDS.receiptId, status: 'CAPTURED' },
        expectedVersion: card.version,
      },
    ])
    expect(then.created.event).toMatchObject({ type: 'receipt.created', data: { correctionOf: given.id } })
  })

  it('현금 결제를 정정하면 앞 결제는 취소하고 요청의 결제로 다시 받으며, 고친 메모를 씁니다', () => {
    const cash = testPayment()
    const transfer = { method: 'BANK_TRANSFER' as const, amount: { taxable: 0, taxExempt: 10_000 } }

    const then = success(
      decideCorrection(
        receipt,
        { reason: '계좌이체였음', payments: [transfer], memo: '계좌이체' },
        facts({ payments: [cash] }),
        TEST_RECEIPT_IDS,
        TEST_CONTEXT,
      ),
    )

    expect(then.voided.voided).toMatchObject([{ id: cash.id, status: 'VOIDED' }])
    expect(then.created.changes.insertPayments).toMatchObject([{ method: 'BANK_TRANSFER', status: 'CAPTURED' }])
    expect(then.created.receipt.memo).toBe('계좌이체')
  })

  it('정정한 결제로 결산이 막히면 앞 영수증을 취소하지 않고 거부합니다', () => {
    const then = failure(
      decideCorrection(
        receipt,
        { reason: '정정' },
        facts({ payments: [testPayment()] }),
        TEST_RECEIPT_IDS,
        TEST_CONTEXT,
      ),
    )

    expect(then).toMatchObject({ _tag: 'CheckoutRejected', warnings: ['OUTSTANDING'] })
  })

  it('이미 취소한 영수증은 거부합니다', () => {
    const voided = { ...receipt, status: 'VOIDED' as const }

    expect(failure(decideCorrection(voided, { reason: '정정' }, facts(), TEST_RECEIPT_IDS, TEST_CONTEXT))._tag).toBe(
      'ReceiptVoided',
    )
  })
})
