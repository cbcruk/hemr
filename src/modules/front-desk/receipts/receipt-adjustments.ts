import type { Id } from '../../../shared/ids/ids.types.ts'
import {
  ExternalPaymentMethod,
  type Payment,
  type ReceiptPayment,
  type ReceiptRecord,
  type ReceiptSettlement,
  type Refund,
  type RefundErrorCode,
  type RefundMethod,
} from './receipt.ts'

type Split = { taxable: number; taxExempt: number }

const EXTERNAL: ReadonlySet<string> = new Set(ExternalPaymentMethod.literals)

/** 밖에서 취소해야 하는 결제 수단인지입니다. 영수증을 취소하기 전에 환불해야 합니다. */
export const isExternal = (payment: Pick<Payment, 'method'>) => EXTERNAL.has(payment.method)

/** 지금까지 환불한 금액입니다. */
export const refundedOf = (payment: Pick<Payment, 'refunds'>): Split =>
  payment.refunds.reduce(
    (sum, each) => ({
      taxable: sum.taxable + each.amount.taxable,
      taxExempt: sum.taxExempt + each.amount.taxExempt,
    }),
    { taxable: 0, taxExempt: 0 },
  )

/** 더 환불할 수 있는 금액입니다. */
export const refundableOf = (payment: Pick<Payment, 'amount' | 'refunds'>): Split => {
  const refunded = refundedOf(payment)
  return {
    taxable: payment.amount.taxable - refunded.taxable,
    taxExempt: payment.amount.taxExempt - refunded.taxExempt,
  }
}

/** 영수증의 결제로 보이는 필드입니다. */
export const toReceiptPayment = (payment: Payment): ReceiptPayment => ({
  id: payment.id,
  method: payment.method,
  prepaidKind: payment.prepaidKind,
  amount: payment.amount,
  processorRef: payment.processorRef,
  // 영수증에 붙은 결제는 적용된 뒤라 `UNAPPLIED`가 아닙니다
  status: payment.status === 'UNAPPLIED' ? 'CAPTURED' : payment.status,
  refunded: refundedOf(payment),
})

/**
 * 원 결제 수단별로 쓸 수 있는 환불 수단입니다 (front-desk.md 환불 수단 제약). 서버가 만드는 제주 지원금·패키지는
 * 환불하지 않습니다.
 */
export function allowedRefundMethods(method: Payment['method']): ReadonlyArray<RefundMethod> {
  switch (method) {
    case 'CARD':
      return ['CARD_CANCEL']
    case 'KAKAO_PAY':
    case 'LOCAL_CURRENCY':
    case 'ZERO_PAY':
      return [method, 'BANK_TRANSFER', 'CASH']
    case 'CASH':
    case 'BANK_TRANSFER':
      return ['BANK_TRANSFER', 'CASH']
    case 'OVERPAID_CREDIT':
      return ['OVERPAID_CREDIT']
    case 'PREPAID':
      return ['PREPAID']
    case 'JEJU_SUBSIDY':
    case 'PACKAGE':
      return []
  }
}

export interface RefundRequest {
  amount: Split
  method: RefundMethod
  reason: string
  writeOff: boolean
  at: string
  by: Id<'user'>
}

export type RefundDecision =
  | { ok: true; payment: Payment; refund: Refund; settlement: ReceiptSettlement | null }
  | { ok: false; errors: RefundErrorCode[]; allowedMethods: ReadonlyArray<RefundMethod>; refundable: Split }

/**
 * 결제 하나를 환불합니다. 환불 수단이 원 결제 수단에 맞아야 하고, 과세·비과세 각각 남은 금액까지만 돌려줍니다. 미적용
 * 결제는 영수증이 없어 나눠 돌려줄 이유가 없으므로 전액만 받습니다.
 *
 * 적용한 결제면 그 영수증의 결산(`settlement`)을 받아 환불 뒤 결산도 돌려주고, 이 환불로 실제 손비가 된 금액을 환불
 * 기록에 남깁니다. 미적용 결제는 `null`이고 손비도 0입니다.
 *
 * 환불할 수 있는 상태(`UNAPPLIED`·`CAPTURED`·`PARTIALLY_REFUNDED`)인지는 부르는 쪽이 먼저 봅니다.
 */
export function refundPayment(
  payment: Payment,
  request: RefundRequest,
  settlement: ReceiptSettlement | null,
): RefundDecision {
  const allowedMethods = allowedRefundMethods(payment.method)
  const refundable = refundableOf(payment)
  const errors: RefundErrorCode[] = []
  if (!allowedMethods.includes(request.method)) errors.push('METHOD_NOT_ALLOWED')
  if (request.amount.taxable > refundable.taxable || request.amount.taxExempt > refundable.taxExempt) {
    errors.push('AMOUNT_EXCEEDED')
  } else if (
    payment.status === 'UNAPPLIED' &&
    (request.amount.taxable !== refundable.taxable || request.amount.taxExempt !== refundable.taxExempt)
  ) {
    errors.push('PARTIAL_UNAPPLIED')
  }
  if (errors.length > 0) return { ok: false, errors, allowedMethods, refundable }

  const after = settlement === null ? null : settlementAfterRefund(settlement, request.amount, request.writeOff)
  const refund: Refund = {
    amount: request.amount,
    method: request.method,
    reason: request.reason,
    writtenOff: settlement === null || after === null ? 0 : after.writtenOff - settlement.writtenOff,
    at: request.at,
    by: request.by,
  }
  const left = {
    taxable: refundable.taxable - request.amount.taxable,
    taxExempt: refundable.taxExempt - request.amount.taxExempt,
  }
  return {
    ok: true,
    refund,
    settlement: after,
    payment: {
      ...payment,
      refunds: [...payment.refunds, refund],
      status: left.taxable === 0 && left.taxExempt === 0 ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      updatedAt: request.at,
      version: payment.version + 1,
    },
  }
}

/**
 * 결제를 환불한 뒤의 결산입니다. 받은 금액에서 돌려준 금액을 빼고 남은 금액을 다시 판정합니다. 손비 환불이면 늘어난
 * 남은 금액을 미수 대신 손비로 둡니다. 손비는 남은 금액보다 크지 않습니다.
 */
export function settlementAfterRefund(
  settlement: ReceiptSettlement,
  amount: Split,
  writeOff: boolean,
): ReceiptSettlement {
  const received = {
    taxable: settlement.received.taxable - amount.taxable,
    taxExempt: settlement.received.taxExempt - amount.taxExempt,
  }
  const total = amount.taxable + amount.taxExempt
  const remaining = settlement.due.taxable + settlement.due.taxExempt - (received.taxable + received.taxExempt)
  const positive = Math.max(remaining, 0)
  const writtenOff = Math.min(positive, settlement.writtenOff + (writeOff ? total : 0))
  const outstanding = positive - writtenOff
  const overpaid = Math.max(-remaining, 0)
  return {
    ...settlement,
    received,
    outstanding,
    overpaid,
    writtenOff,
    result: overpaid > 0 ? 'OVERPAID' : outstanding > 0 ? 'OUTSTANDING' : writtenOff > 0 ? 'WRITTEN_OFF' : 'PAID',
  }
}

export interface VoidRequest {
  reason: string
  at: string
  by: Id<'user'>
  /** 정정이면 새 영수증입니다. 밖에서 취소해야 하는 결제를 새 영수증으로 옮깁니다. */
  correctedBy?: Id<'receipt'>
}

export type VoidDecision =
  | { ok: true; receipt: ReceiptRecord; voided: Payment[]; carried: Payment[] }
  | { ok: false; paymentIds: Array<Id<'payment'>> }

/**
 * 영수증을 취소합니다. 남은 돈이 있는 결제를 이렇게 처리합니다.
 *
 * - 서버 안에서 받은 결제(현금·계좌이체 등)는 받지 않은 것으로 `VOIDED`가 됩니다. 이미 일부 환불했으면 남은 금액만
 *   받지 않은 것입니다
 * - 밖에서 취소해야 하는 결제(카드·간편결제 등)는 취소하지 않습니다. 단순 취소면 먼저 전액 환불해야 해서 막고
 *   (`ok: false`), 정정이면 새 영수증으로 옮깁니다(`carried`)
 *
 * 이미 전액 환불했거나 취소한 결제는 그대로 둡니다. 영수증이 `ACTIVE`인지는 부르는 쪽이 먼저 봅니다.
 */
export function voidReceipt(
  receipt: ReceiptRecord,
  payments: ReadonlyArray<Payment>,
  request: VoidRequest,
): VoidDecision {
  const open = payments.filter((each) => each.status === 'CAPTURED' || each.status === 'PARTIALLY_REFUNDED')
  const external = open.filter(isExternal)
  if (request.correctedBy === undefined && external.length > 0) {
    return { ok: false, paymentIds: external.map((each) => each.id) }
  }
  return {
    ok: true,
    receipt: {
      ...receipt,
      status: 'VOIDED',
      voided: { at: request.at, by: request.by, reason: request.reason, correctedBy: request.correctedBy ?? null },
      updatedAt: request.at,
      version: receipt.version + 1,
    },
    voided: open
      .filter((each) => !isExternal(each))
      .map((each) => ({ ...each, status: 'VOIDED' as const, updatedAt: request.at, version: each.version + 1 })),
    carried: request.correctedBy === undefined ? [] : external,
  }
}
