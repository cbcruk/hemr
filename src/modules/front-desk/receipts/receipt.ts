import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'
import { EncounterId } from '../../clinical/encounters/encounter-id.ts'
import { TenantId, UserId } from '../../identity/identity.ts'
import { PatientId } from '../../patients/patient.ts'
import { VisitId } from '../visits/visit.ts'

// 설명은 `refine` 앞에 답니다. 뒤에 달면 OpenAPI 문서에서 빠집니다
export const ReceiptId = Schema.String.annotate({ description: '영수증(수납) ID입니다. 예: `rcp_01J...`' }).pipe(
  Schema.refine((value): value is Id<'receipt'> => isId('receipt', value)),
)

export const PaymentId = Schema.String.annotate({ description: '결제 ID입니다. 예: `pay_01J...`' }).pipe(
  Schema.refine((value): value is Id<'payment'> => isId('payment', value)),
)

export const QuoteId = Schema.String.annotate({
  description: '견적 ID입니다. 저장하지 않고 견적 금액에서 계산하므로 금액이 같으면 같은 ID입니다. 예: `qt_...`',
}).pipe(Schema.refine((value): value is Id<'quote'> => isId('quote', value)))

export const Won = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(10_000_000_000),
).annotate({ description: '원 단위 금액입니다. 0 이상 정수입니다.' })

// 수납이 계산한 값은 처방 수정으로 한쪽이 음수일 수 있어 부호를 막지 않습니다
export const SplitAmount = Schema.Struct({
  taxable: Schema.Int.annotate({ description: '과세 금액(원)입니다.' }),
  taxExempt: Schema.Int.annotate({ description: '비과세 금액(원)입니다.' }),
}).annotate({ identifier: 'SplitAmount', description: '과세·비과세로 나눈 금액입니다.' })

// `checkout-settlement.types.ts`의 `PaymentMethod`와 같습니다
export const PaymentMethod = Schema.Literals([
  'CARD',
  'CASH',
  'BANK_TRANSFER',
  'KAKAO_PAY',
  'LOCAL_CURRENCY',
  'ZERO_PAY',
  'PREPAID',
  'OVERPAID_CREDIT',
  'JEJU_SUBSIDY',
  'PACKAGE',
]).annotate({
  identifier: 'PaymentMethod',
  description:
    '결제 수단입니다. 카드(`CARD`), 현금(`CASH`), 계좌이체(`BANK_TRANSFER`), 카카오페이(`KAKAO_PAY`), 지역화폐(`LOCAL_CURRENCY`), 제로페이(`ZERO_PAY`), 선수금(`PREPAID`), 과수납금(`OVERPAID_CREDIT`), 제주 지원금(`JEJU_SUBSIDY`), 패키지(`PACKAGE`)입니다. 과수납금·제주 지원금·패키지는 서버가 만드는 수단이고, 지금은 과수납 잔액·제주 지원금·패키지가 없어 만들지 않습니다.',
})

export const PrepaidKind = Schema.Literals(['CASH_LIKE', 'CARD_LIKE']).annotate({
  identifier: 'PrepaidKind',
  description: '선수금 계열입니다. 현금 계열(`CASH_LIKE`)과 카드 계열(`CARD_LIKE`)의 잔액을 따로 셉니다.',
})

export const ExternalPaymentMethod = Schema.Literals(['CARD', 'KAKAO_PAY', 'LOCAL_CURRENCY', 'ZERO_PAY']).annotate({
  identifier: 'ExternalPaymentMethod',
  description:
    '카드 단말·간편결제처럼 수납 전에 밖에서 승인되는 결제 수단입니다. `POST /payments`로 먼저 남기고 수납의 `paymentIds`로 적용합니다.',
})
export type ExternalPaymentMethod = typeof ExternalPaymentMethod.Type

export const PaymentStatus = Schema.Literals([
  'UNAPPLIED',
  'CAPTURED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'VOIDED',
]).annotate({
  identifier: 'PaymentStatus',
  title: '결제 상태',
  description:
    '수납 전(`UNAPPLIED`), 수납에 적용함(`CAPTURED`), 일부 환불(`PARTIALLY_REFUNDED`), 전액 환불(`REFUNDED`), 영수증 취소로 받지 않은 것으로 함(`VOIDED`)입니다. 수납 전 결제는 전액 환불만 받아 `UNAPPLIED`에서 바로 `REFUNDED`가 됩니다.',
})
export type PaymentStatus = typeof PaymentStatus.Type

export const RefundMethod = Schema.Literals([
  'CARD_CANCEL',
  'KAKAO_PAY',
  'LOCAL_CURRENCY',
  'ZERO_PAY',
  'CASH',
  'BANK_TRANSFER',
  'OVERPAID_CREDIT',
  'PREPAID',
]).annotate({
  identifier: 'RefundMethod',
  description:
    '환불 수단입니다. `CARD_CANCEL`은 카드 승인 취소, 카카오페이·지역화폐·제로페이는 같은 수단의 취소입니다. 원 결제 수단마다 쓸 수 있는 환불 수단이 다릅니다. 카드는 `CARD_CANCEL`, 카카오페이·지역화폐·제로페이는 같은 수단 취소·`BANK_TRANSFER`·`CASH`, 현금·계좌이체는 `BANK_TRANSFER`·`CASH`, 과수납금은 `OVERPAID_CREDIT`, 선수금은 같은 계열 `PREPAID`이고, 제주 지원금·패키지는 환불할 수 없습니다. 어긋나면 422 `REFUND_REJECTED`의 `allowedMethods`가 쓸 수 있는 수단입니다.',
})
export type RefundMethod = typeof RefundMethod.Type

export const Refund = Schema.Struct({
  amount: SplitAmount,
  method: RefundMethod,
  reason: Schema.String,
  writtenOff: Schema.Int.annotate({
    description:
      '이 환불로 미수 대신 손비로 둔 금액입니다. 요청의 `writeOff`가 참이어도 과수납을 돌려준 부분은 손비가 아니라 0일 수 있습니다.',
  }),
  at: Schema.String,
  by: UserId,
}).annotate({
  identifier: 'Refund',
  title: '환불',
  description: '결제 하나의 환불 기록입니다. 환불은 원 결제를 고치지 않고 덧붙입니다.',
})
export type Refund = typeof Refund.Type

export const Payment = Schema.Struct({
  id: PaymentId,
  // 다른 병원의 결제는 없는 것과 같이 다룹니다(404)
  tenantId: TenantId,
  patientId: PatientId,
  visitId: Schema.NullOr(VisitId).annotate({
    description:
      '결제를 받은 내원입니다. 기록할 때 정했으면 그 내원의 수납에만 적용하고, 없으면 적용한 수납의 내원이 됩니다.',
  }),
  receiptId: Schema.NullOr(ReceiptId).annotate({
    description:
      '적용한 영수증입니다. 수납에 적용하지 않은 결제(`UNAPPLIED`, 수납 전에 환불한 `REFUNDED`)는 `null`입니다.',
  }),
  method: PaymentMethod,
  prepaidKind: Schema.NullOr(PrepaidKind).annotate({ description: '선수금 계열입니다. 선수금이 아니면 `null`입니다.' }),
  amount: SplitAmount,
  processorRef: Schema.NullOr(Schema.String).annotate({
    description: '카드 승인번호처럼 밖에서 받은 참조입니다. 수납 요청 안에서 받은 현금·계좌이체는 `null`입니다.',
  }),
  status: PaymentStatus,
  refunds: Schema.Array(Refund).annotate({ description: '환불 기록입니다. 시각 순서입니다.' }),
  recordedBy: UserId,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  version: Schema.Int,
}).annotate({
  identifier: 'Payment',
  title: '결제',
  description:
    '결제입니다. 외부 승인 결제는 `POST /payments`로 영수증 없이(`UNAPPLIED`) 먼저 남고, 수납이 적용하면 `CAPTURED`가 됩니다. 현금·계좌이체처럼 수납 요청 안에서 받는 결제는 처음부터 `CAPTURED`입니다.',
})
export type Payment = typeof Payment.Type

export const ReceiptPayment = Schema.Struct({
  id: PaymentId,
  method: PaymentMethod,
  prepaidKind: Schema.NullOr(PrepaidKind),
  amount: SplitAmount,
  processorRef: Schema.NullOr(Schema.String),
  status: Schema.Literals(['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED']),
  refunded: SplitAmount,
}).annotate({
  identifier: 'ReceiptPayment',
  description:
    '영수증에 적용한 결제입니다. `refunded`는 지금까지 환불한 금액이고, 환불 기록 전체는 `GET /payments/{id}`입니다.',
})
export type ReceiptPayment = typeof ReceiptPayment.Type

/** 영수증의 결제 순서입니다. 받은 시각, 같으면 ID 순입니다. 저장소와 수납이 같은 순서로 돌려줍니다. */
export const byRecorded = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0

// 패키지 판매·할인은 그 기능이 생길 때 더합니다
export const ReceiptCharges = Schema.Struct({
  insuredCopay: Schema.Int.annotate({ description: '급여 본인부담입니다. 비과세에 들어갑니다.' }),
  nonbenefit: SplitAmount,
  total: Schema.Int.annotate({ description: '청구 합계(급여 본인부담 + 비급여)입니다.' }),
}).annotate({ identifier: 'ReceiptCharges', description: '서버가 계산한 청구 금액입니다.' })
export type ReceiptCharges = typeof ReceiptCharges.Type

export const SettlementResult = Schema.Literals(['PAID', 'OUTSTANDING', 'OVERPAID', 'WRITTEN_OFF']).annotate({
  identifier: 'SettlementResult',
  title: '결산 결과',
  description: '완납(`PAID`), 미수(`OUTSTANDING`), 과수납(`OVERPAID`), 손비(`WRITTEN_OFF`)입니다.',
})

export const CheckoutWarningCode = Schema.Literals(['OUTSTANDING']).annotate({
  identifier: 'CheckoutWarningCode',
  description: '결제 없이 남은 금액을 미수로 남기는 경고(`OUTSTANDING`)입니다.',
})

// 판정은 `settleCheckout`입니다
export const ReceiptSettlement = Schema.Struct({
  due: SplitAmount,
  received: SplitAmount,
  result: SettlementResult,
  outstanding: Schema.Int.annotate({ description: '미수 금액입니다.' }),
  overpaid: Schema.Int.annotate({ description: '과수납 금액입니다.' }),
  writtenOff: Schema.Int.annotate({ description: '손비로 둔 금액입니다.' }),
  acknowledged: Schema.Array(CheckoutWarningCode).annotate({
    description: '확인을 받고 넘어간 경고입니다.',
  }),
}).annotate({
  identifier: 'ReceiptSettlement',
  description:
    '결산입니다. 받을 금액(`due`)과 받은 금액(`received`)이고, `due − received`가 남은 금액입니다. 받은 금액에는 제주 지원금·과수납금 결제도 들어갑니다(지금은 둘 다 0입니다).',
})
export type ReceiptSettlement = typeof ReceiptSettlement.Type

export const ReceiptVoid = Schema.Struct({
  at: Schema.String,
  by: UserId,
  reason: Schema.String,
  correctedBy: Schema.NullOr(ReceiptId).annotate({
    description: '정정(`:correct`)으로 취소했으면 새 영수증입니다.',
  }),
}).annotate({ identifier: 'ReceiptVoid', description: '영수증 취소 기록입니다.' })

// 내원 없는 수납은 그 기능이 생길 때 더합니다
export const Receipt = Schema.Struct({
  id: ReceiptId,
  // 다른 병원의 영수증은 없는 것과 같이 다룹니다(404)
  tenantId: TenantId,
  visitId: VisitId,
  patientId: PatientId,
  date: Schema.String.annotate({
    description: '수납한 날(병원 시간대)입니다. 내원일이 아닙니다. 시재가 이 날의 현금으로 셉니다.',
  }),
  cashierId: UserId,
  memo: Schema.String,
  encounterIds: Schema.Array(EncounterId).annotate({ description: '수납한 진료입니다.' }),
  quoteId: QuoteId,
  charges: ReceiptCharges,
  payments: Schema.Array(ReceiptPayment).annotate({
    description: '적용한 결제입니다. 받은 시각, 같으면 ID 순서입니다. 정정으로 옮긴 결제는 새 영수증에 있습니다.',
  }),
  settlement: ReceiptSettlement,
  flags: Schema.Struct({
    excludeFromTaxDeduction: Schema.Boolean.annotate({ description: '연말정산 의료비 공제에서 뺍니다.' }),
  }),
  status: Schema.Literals(['ACTIVE', 'VOIDED']).annotate({ description: '유효(`ACTIVE`)와 취소(`VOIDED`)입니다.' }),
  voided: Schema.NullOr(ReceiptVoid).annotate({ description: '취소했으면 그 기록입니다. 유효하면 `null`입니다.' }),
  correctionOf: Schema.NullOr(ReceiptId).annotate({
    description: '정정으로 만든 영수증이면 취소한 앞 영수증입니다.',
  }),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  version: Schema.Int,
}).annotate({
  identifier: 'Receipt',
  title: '수납',
  description:
    '영수증(수납)입니다. 한 내원의 진료를 한 번에 수납한 기록입니다. 돈 기록이라 지우지 않고, 잘못 입력했으면 취소해 `VOIDED`로 남깁니다. 전체 리소스는 `docs/design/front-desk.md`의 수납을 보세요.',
})
export type Receipt = typeof Receipt.Type

/** 저장하는 영수증입니다. 결제는 따로 저장하고 읽을 때 붙입니다. */
export type ReceiptRecord = Omit<Receipt, 'payments'>

/** 영수증에서 저장하는 부분입니다. */
export const recordOf = ({ payments: _, ...record }: Receipt): ReceiptRecord => record

// `checkout-settlement.types.ts`의 `CheckoutErrorCode`와 같습니다
export const CheckoutErrorCode = Schema.Literals([
  'PAYMENT_METHOD_NOT_ALLOWED',
  'PREPAID_KIND_REQUIRED',
  'PREPAID_BALANCE_INSUFFICIENT',
  'WRITE_OFF_OVERPAID',
]).annotate({
  identifier: 'CheckoutErrorCode',
  description:
    '결산 오류입니다. 받을 수 없는 결제 수단, 선수금 계열 없음, 선수금 잔액 부족, 과수납인데 손비 처리입니다.',
})

export class CheckoutRejected extends HttpApiError.Problem<CheckoutRejected>()(
  'CheckoutRejected',
  { type: problemType('CHECKOUT_REJECTED'), status: 422, title: 'Checkout rejected' },
  {
    code: Schema.tag('CHECKOUT_REJECTED'),
    errors: Schema.Array(CheckoutErrorCode),
    warnings: Schema.Array(CheckoutWarningCode),
  },
  { description: '결산이 수납을 막았습니다. 결제 오류(`errors`)나 확인을 받지 않은 경고(`warnings`)를 모두 담습니다.' },
) {}

export class QuoteStale extends HttpApiError.Problem<QuoteStale>()(
  'QuoteStale',
  { type: problemType('QUOTE_STALE'), status: 409, title: 'Charges changed after the quote' },
  { code: Schema.tag('QUOTE_STALE'), quoteId: QuoteId },
  { description: '견적 뒤 청구 금액이 바뀌었습니다. 새 견적을 받아 다시 수납합니다.' },
) {}

export class ReceiptAlreadyExists extends HttpApiError.Problem<ReceiptAlreadyExists>()(
  'ReceiptAlreadyExists',
  { type: problemType('RECEIPT_ALREADY_EXISTS'), status: 409, title: 'Visit already has a receipt' },
  { code: Schema.tag('RECEIPT_ALREADY_EXISTS'), receiptId: ReceiptId },
  {
    description:
      '내원에 이미 유효한 영수증이 있습니다. 수납 뒤 `:reopen`한 내원을 다시 수납하려면 먼저 그 영수증을 취소합니다(`:void`). 결제만 고치려면 `:correct`입니다.',
  },
) {}

export class CheckoutEncounterInvalid extends HttpApiError.Problem<CheckoutEncounterInvalid>()(
  'CheckoutEncounterInvalid',
  { type: problemType('CHECKOUT_ENCOUNTER_INVALID'), status: 422, title: 'Encounter cannot be checked out here' },
  { code: Schema.tag('CHECKOUT_ENCOUNTER_INVALID'), encounterIds: Schema.Array(Schema.String) },
  { description: '고른 진료가 이 내원의 수납할 수 있는 진료가 아닙니다(다른 내원, 철회, 없음).' },
) {}

export class CheckoutCoverageUnsupported extends HttpApiError.Problem<CheckoutCoverageUnsupported>()(
  'CheckoutCoverageUnsupported',
  {
    type: problemType('CHECKOUT_COVERAGE_UNSUPPORTED'),
    status: 422,
    title: 'Insured copay cannot be calculated for these encounters',
  },
  { code: Schema.tag('CHECKOUT_COVERAGE_UNSUPPORTED'), encounterIds: Schema.Array(EncounterId) },
  {
    description:
      '급여 본인부담을 계산할 수 없는 진료입니다. 자보·산재, 해석하지 않은 본인부담여부, 추나·첩약 시범처럼 따로 매기는 급여 라인, 생년월일이 없는 환자의 급여 라인이 그렇습니다. 규칙은 `docs/reference/rules/insured-copay.md`에 있습니다.',
  },
) {}

export class CheckoutPaymentInvalid extends HttpApiError.Problem<CheckoutPaymentInvalid>()(
  'CheckoutPaymentInvalid',
  { type: problemType('CHECKOUT_PAYMENT_INVALID'), status: 422, title: 'Payment cannot be applied here' },
  { code: Schema.tag('CHECKOUT_PAYMENT_INVALID'), paymentIds: Schema.Array(Schema.String) },
  { description: '고른 결제를 이 수납에 적용할 수 없습니다(없음, 이미 적용함, 다른 환자, 다른 내원).' },
) {}

export class PaymentNotFound extends HttpApiError.Problem<PaymentNotFound>()(
  'PaymentNotFound',
  { type: problemType('PAYMENT_NOT_FOUND'), status: 404, title: 'Payment not found' },
  { code: Schema.tag('PAYMENT_NOT_FOUND') },
  { description: '요청한 ID의 결제가 없습니다. 다른 병원의 결제도 없는 것과 같습니다.' },
) {}

export class PaymentVisitMismatch extends HttpApiError.Problem<PaymentVisitMismatch>()(
  'PaymentVisitMismatch',
  { type: problemType('PAYMENT_VISIT_MISMATCH'), status: 422, title: 'Visit belongs to another patient' },
  { code: Schema.tag('PAYMENT_VISIT_MISMATCH') },
  { description: '결제의 내원이 결제의 환자의 내원이 아닙니다.' },
) {}

export class ReceiptNotFound extends HttpApiError.Problem<ReceiptNotFound>()(
  'ReceiptNotFound',
  { type: problemType('RECEIPT_NOT_FOUND'), status: 404, title: 'Receipt not found' },
  { code: Schema.tag('RECEIPT_NOT_FOUND') },
  { description: '요청한 ID의 영수증이 없습니다. 다른 병원의 영수증도 없는 것과 같습니다.' },
) {}

export class ReceiptVoided extends HttpApiError.Problem<ReceiptVoided>()(
  'ReceiptVoided',
  { type: problemType('RECEIPT_VOIDED'), status: 409, title: 'Receipt is already voided' },
  { code: Schema.tag('RECEIPT_VOIDED') },
  { description: '이미 취소한 영수증입니다. 취소·정정할 수 없습니다.' },
) {}

export class PaymentRefundRequired extends HttpApiError.Problem<PaymentRefundRequired>()(
  'PaymentRefundRequired',
  { type: problemType('PAYMENT_REFUND_REQUIRED'), status: 409, title: 'Payments must be refunded first' },
  { code: Schema.tag('PAYMENT_REFUND_REQUIRED'), receiptId: ReceiptId, paymentIds: Schema.Array(PaymentId) },
  {
    description:
      '밖에서 취소해야 하는 결제(카드·간편결제 등)가 남아 영수증을 취소할 수 없습니다. 먼저 `:refund`로 전액 환불합니다.',
  },
) {}

export class PaymentNotRefundable extends HttpApiError.Problem<PaymentNotRefundable>()(
  'PaymentNotRefundable',
  { type: problemType('PAYMENT_NOT_REFUNDABLE'), status: 409, title: 'Payment cannot be refunded' },
  { code: Schema.tag('PAYMENT_NOT_REFUNDABLE'), paymentStatus: PaymentStatus },
  {
    description:
      '이 결제는 지금 환불할 수 없습니다(이미 전액 환불했거나 취소함). 서버가 만든 수단은 422 `REFUND_REJECTED`입니다.',
  },
) {}

export const RefundErrorCode = Schema.Literals(['METHOD_NOT_ALLOWED', 'AMOUNT_EXCEEDED', 'PARTIAL_UNAPPLIED']).annotate(
  {
    identifier: 'RefundErrorCode',
    description:
      '환불 요청이 결제와 맞지 않는 이유입니다. 쓸 수 없는 환불 수단, 남은 금액 초과, 수납 전 결제의 일부 환불입니다.',
  },
)
export type RefundErrorCode = typeof RefundErrorCode.Type

export class RefundRejected extends HttpApiError.Problem<RefundRejected>()(
  'RefundRejected',
  { type: problemType('REFUND_REJECTED'), status: 422, title: 'Refund rejected' },
  {
    code: Schema.tag('REFUND_REJECTED'),
    errors: Schema.Array(RefundErrorCode),
    allowedMethods: Schema.Array(RefundMethod),
    refundable: SplitAmount,
  },
  {
    description:
      '환불 요청이 결제와 맞지 않습니다. `errors`에 이유를 모두 담고, `allowedMethods`는 이 결제에 쓸 수 있는 환불 수단, `refundable`은 더 환불할 수 있는 금액입니다.',
  },
) {}
