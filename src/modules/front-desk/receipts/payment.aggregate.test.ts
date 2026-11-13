import { describe, expect, it } from 'vitest'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { testVisit } from '../visits/testing.ts'
import { decideRecordPayment, decideRefund } from './payment.aggregate.ts'
import type { RecordPaymentCommand } from './payment.aggregate.ts'
import { failure, success, TEST_CONTEXT, testPayment, testReceipt } from './testing.ts'

/**
 * 결제 판정 함수의 테스트입니다. given(결제와 적용한 영수증) / when(커맨드) / then(다음 결제·영수증과 이벤트, 또는
 * 거부)으로 씁니다. 저장·권한·동시성은 서비스 테스트(`receipts.test.ts`)가 봅니다.
 */

const PAYMENT_ID = 'pay_01JBQ000000000000000000007' as Id<'payment'>

describe('decideRecordPayment', () => {
  const visit = testVisit()
  const command: RecordPaymentCommand = {
    patientId: visit.patientId,
    visitId: visit.id,
    method: 'CARD',
    amount: { taxable: 0, taxExempt: 10_000 },
    processorRef: 'APPROVAL-1',
  }

  it('밖에서 승인된 결제를 영수증 없이 미적용으로 남기고 결제 기록 이벤트를 냅니다', () => {
    const then = success(decideRecordPayment(command, visit, PAYMENT_ID, TEST_CONTEXT))

    expect(then.payment).toMatchObject({
      id: PAYMENT_ID,
      visitId: visit.id,
      receiptId: null,
      status: 'UNAPPLIED',
      recordedBy: TEST_CONTEXT.userId,
      version: 1,
    })
    expect(then.event).toMatchObject({
      type: 'payment.recorded',
      subject: PAYMENT_ID,
      data: { paymentId: PAYMENT_ID, patientId: visit.patientId, method: 'CARD', amount: command.amount },
    })
  })

  it('취소한 내원의 결제도 남깁니다', () => {
    const canceled = testVisit({ status: 'CANCELED' })

    expect(success(decideRecordPayment(command, canceled, PAYMENT_ID, TEST_CONTEXT)).payment.status).toBe('UNAPPLIED')
  })

  it('다른 환자의 내원이면 거부합니다', () => {
    const others = testVisit({ patientId: 'pat_01JBQ000000000000000000002' as Id<'patient'> })

    expect(failure(decideRecordPayment(command, others, PAYMENT_ID, TEST_CONTEXT))._tag).toBe('PaymentVisitMismatch')
  })
})

describe('decideRefund', () => {
  const receipt = testReceipt({ version: 2 })
  const refund = { amount: { taxable: 0, taxExempt: 4_000 }, refundMethod: 'CASH' as const, reason: '과청구' }

  it('적용한 결제의 일부를 환불하면 결제와 영수증의 결산을 같이 고치고, 돌려준 날을 담은 환불 이벤트를 냅니다', () => {
    const given = testPayment()

    const then = success(decideRefund(given, receipt, refund, TEST_CONTEXT))

    expect(then.payment).toMatchObject({ status: 'PARTIALLY_REFUNDED', version: given.version + 1 })
    expect(then.expectedVersion).toBe(given.version)
    expect(then.receipt).toMatchObject({
      receipt: {
        settlement: { received: { taxExempt: 6_000 }, result: 'OUTSTANDING', outstanding: 4_000 },
        version: 3,
      },
      expectedVersion: 2,
    })
    expect(then.event).toMatchObject({
      type: 'payment.refunded',
      subject: given.id,
      data: { receiptId: receipt.id, date: TEST_CONTEXT.today, amount: refund.amount, method: 'CASH', writtenOff: 0 },
    })
  })

  it('미적용 결제는 전액 환불하고 고칠 영수증이 없습니다', () => {
    const given = testPayment({ method: 'CARD', status: 'UNAPPLIED', receiptId: null })

    const then = success(
      decideRefund(given, null, { ...refund, amount: given.amount, refundMethod: 'CARD_CANCEL' }, TEST_CONTEXT),
    )

    expect(then.payment.status).toBe('REFUNDED')
    expect(then.receipt).toBeNull()
  })

  it('원 결제 수단에 맞지 않는 환불 수단은 허용하는 수단을 담아 거부합니다', () => {
    const given = testPayment({ method: 'CARD' })

    const then = failure(decideRefund(given, receipt, refund, TEST_CONTEXT))

    expect(then).toMatchObject({
      _tag: 'RefundRejected',
      errors: ['METHOD_NOT_ALLOWED'],
      allowedMethods: ['CARD_CANCEL'],
    })
  })

  it.each(['REFUNDED', 'VOIDED'] as const)('%s 결제는 환불하지 않습니다', (status) => {
    const then = failure(decideRefund(testPayment({ status }), receipt, refund, TEST_CONTEXT))

    expect(then).toMatchObject({ _tag: 'PaymentNotRefundable', paymentStatus: status })
  })

  it('적용한 영수증이 유효하지 않으면 결함으로 멈춥니다', () => {
    const voided = { ...receipt, status: 'VOIDED' as const }

    expect(() => decideRefund(testPayment(), voided, refund, TEST_CONTEXT)).toThrow('not active')
  })
})
