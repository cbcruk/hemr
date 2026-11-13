import { Result } from 'effect'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { eventContext } from '../../../shared/decision/decision-context.ts'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import type { DecisionContext } from '../../../shared/decision/decision-context.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { Visit } from '../visits/visit.ts'
import { refundPayment } from './receipt-adjustments.ts'
import { PaymentNotRefundable, PaymentVisitMismatch, RefundRejected } from './receipt.ts'
import type { ExternalPaymentMethod, Payment, ReceiptRecord, RefundMethod, SplitAmount } from './receipt.ts'

/**
 * 결제 애그리거트입니다 (docs/design/domain-model.md). 카드 단말·간편결제처럼 수납 전에 돈이 오간 결제를 영수증
 * 없이(`UNAPPLIED`) 남기고, 결제 하나씩 환불합니다. 적용은 수납(`checkout.aggregate.ts`)이 합니다.
 */

/** 밖에서 승인된 결제 하나입니다. */
export interface RecordPaymentCommand {
  patientId: Id<'patient'>
  visitId?: Id<'visit'>
  method: ExternalPaymentMethod
  amount: typeof SplitAmount.Type
  processorRef: string
}

/**
 * 결제 기록을 판정합니다. `visit`은 요청한 내원이고(없으면 `null`), 다른 환자의 내원이면 422
 * `PAYMENT_VISIT_MISMATCH`입니다. 내원의 상태는 보지 않습니다. 돈은 이미 오갔으므로 취소한 내원의 결제도 남깁니다.
 * `payment.recorded`를 냅니다.
 */
export function decideRecordPayment(
  input: RecordPaymentCommand,
  visit: Visit | null,
  paymentId: Id<'payment'>,
  context: DecisionContext,
): Result.Result<{ payment: Payment; event: DomainEvent }, PaymentVisitMismatch> {
  if (visit !== null && visit.patientId !== input.patientId) return Result.fail(new PaymentVisitMismatch({}))
  const payment: Payment = {
    id: paymentId,
    tenantId: context.tenantId,
    patientId: input.patientId,
    visitId: input.visitId ?? null,
    receiptId: null,
    method: input.method,
    prepaidKind: null,
    amount: input.amount,
    processorRef: input.processorRef,
    status: 'UNAPPLIED',
    refunds: [],
    recordedBy: context.userId,
    createdAt: context.at,
    updatedAt: context.at,
    version: 1,
  }
  const event = domainEvent(
    'payment.recorded',
    payment.id,
    context.at,
    {
      paymentId: payment.id,
      patientId: payment.patientId,
      visitId: payment.visitId,
      method: payment.method,
      amount: payment.amount,
    },
    eventContext(context),
  )
  return Result.succeed({ payment, event })
}

/** 환불 입력입니다. */
export interface RefundCommand {
  amount: typeof SplitAmount.Type
  refundMethod: RefundMethod
  reason: string
  writeOff?: boolean
}

/** 환불 판정 결과입니다. 결제와(적용한 결제면) 영수증의 결산을 한 트랜잭션에 씁니다. */
export interface RefundDecision {
  payment: Payment
  expectedVersion: number
  /** 다시 판정한 결산을 담은 영수증입니다. 미적용 결제면 `null`입니다. */
  receipt: { receipt: ReceiptRecord; expectedVersion: number } | null
  event: DomainEvent
}

/**
 * 결제 하나의 환불을 판정합니다. 결제·영수증을 한 트랜잭션에 묶는 경계입니다(domain-model.md 묶은 경계). 환불
 * 수단은 원 결제 수단에 맞아야 하고 과세·비과세 각각 남은 금액까지만 받습니다(422 `REFUND_REJECTED`). 미적용 결제는
 * 전액만 받습니다. 이미 전액 환불했거나 취소한 결제는 409 `PAYMENT_NOT_REFUNDABLE`입니다.
 *
 * `receipt`는 결제를 적용한 영수증이고, 미적용 결제면 `null`입니다. 유효하지 않으면 결함입니다. 받은 금액이 줄어 결산을 다시
 * 판정합니다(`settlementAfterRefund`). `payment.refunded`의 `date`는 돌려준 날이고, 시재가 이 날의 환불로 셉니다.
 */
export function decideRefund(
  payment: Payment,
  receipt: ReceiptRecord | null,
  input: RefundCommand,
  context: DecisionContext,
): Result.Result<RefundDecision, PaymentNotRefundable | RefundRejected> {
  if (payment.status === 'REFUNDED' || payment.status === 'VOIDED') {
    return Result.fail(new PaymentNotRefundable({ paymentStatus: payment.status }))
  }
  // 적용한 결제는 늘 유효한 영수증에 있습니다(영수증을 취소하면 결제도 취소되거나 정정한 영수증으로 옮겨 갑니다)
  if (receipt !== null && receipt.status !== 'ACTIVE') {
    throw new Error(`payment ${payment.id} is applied to a receipt that is not active`)
  }
  const decision = refundPayment(
    payment,
    {
      amount: input.amount,
      method: input.refundMethod,
      reason: input.reason,
      writeOff: input.writeOff ?? false,
      at: context.at,
      by: context.userId,
    },
    receipt?.settlement ?? null,
  )
  if (!decision.ok) {
    return Result.fail(
      new RefundRejected({
        errors: decision.errors,
        allowedMethods: decision.allowedMethods,
        refundable: decision.refundable,
      }),
    )
  }
  const event = domainEvent(
    'payment.refunded',
    payment.id,
    context.at,
    {
      paymentId: payment.id,
      receiptId: payment.receiptId,
      visitId: payment.visitId,
      patientId: payment.patientId,
      date: context.today,
      amount: decision.refund.amount,
      method: decision.refund.method,
      writtenOff: decision.refund.writtenOff,
    },
    eventContext(context),
  )
  return Result.succeed({
    payment: decision.payment,
    expectedVersion: payment.version,
    receipt:
      receipt === null || decision.settlement === null
        ? null
        : {
            receipt: {
              ...receipt,
              settlement: decision.settlement,
              updatedAt: context.at,
              version: receipt.version + 1,
            },
            expectedVersion: receipt.version,
          },
    event,
  })
}
