import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'
import { IdempotencyKey, IdempotencyKeyReused } from '../../../shared/http/idempotency.ts'
import { ValidationFailed } from '../../../shared/problem/problem.ts'
import { EncounterId } from '../../clinical/encounters/encounter-id.ts'
import { Access } from '../../identity/auth/access.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import { LocalDate, PatientId } from '../../patients/patient.ts'
import { VisitId, VisitNotFound, VisitTransitionInvalid } from '../visits/visit.ts'
import {
  CheckoutCoverageUnsupported,
  CheckoutEncounterInvalid,
  CheckoutErrorCode,
  CheckoutPaymentInvalid,
  CheckoutRejected,
  PaymentId,
  PaymentMethod,
  PaymentRefundRequired,
  PrepaidKind,
  QuoteId,
  QuoteStale,
  Receipt,
  ReceiptAlreadyExists,
  ReceiptCharges,
  ReceiptId,
  ReceiptNotFound,
  ReceiptVoided,
  SettlementResult,
  SplitAmount,
  Won,
} from './receipt.ts'
import { CheckedOut } from './receipts.ts'

const params = { id: VisitId }
const strict = { errors: 'all', onExcessProperty: 'error' } as const

/** 수납 요청 안에서 받는 결제 하나입니다. 0원 결제는 받되 기록하지 않습니다. */
const PaymentInput = Schema.Struct({
  method: PaymentMethod,
  prepaidKind: Schema.optionalKey(PrepaidKind),
  amount: Schema.Struct({ taxable: Won, taxExempt: Won }),
})

/** 견적과 수납이 같이 받는 필드입니다. */
const options = {
  encounterIds: Schema.optionalKey(Schema.Array(EncounterId).check(Schema.isMinLength(1), Schema.isMaxLength(20))),
  /** 미리 기록한 외부 승인 결제(`POST /payments`)입니다. */
  paymentIds: Schema.optionalKey(Schema.Array(PaymentId).check(Schema.isMaxLength(20))),
  payments: Schema.optionalKey(Schema.Array(PaymentInput).check(Schema.isMaxLength(20))),
  useOverpaidCredit: Schema.optionalKey(Schema.NullOr(Schema.Literals(['TAX_EXEMPT', 'TAXABLE']))),
  writeOffRemainder: Schema.optionalKey(Schema.Boolean),
  acknowledge: Schema.optionalKey(Schema.Array(Schema.Literals(['OUTSTANDING'])).check(Schema.isMaxLength(1))),
}

const CheckoutQuote = Schema.Struct({
  quoteId: QuoteId,
  encounters: Schema.Array(Schema.Struct({ encounterId: EncounterId, due: SplitAmount })),
  charges: ReceiptCharges,
  settlement: Schema.Struct({
    due: SplitAmount,
    effectiveDue: SplitAmount,
    entered: SplitAmount,
    received: SplitAmount,
    remaining: Schema.Int,
    result: SettlementResult,
    outstanding: Schema.Int,
    overpaid: Schema.Int,
    writtenOff: Schema.Int,
    jejuSubsidy: Schema.Int,
    overpaidCreditApplied: SplitAmount,
  }),
  errors: Schema.Array(CheckoutErrorCode),
  warnings: Schema.Array(Schema.Literals(['OUTSTANDING'])),
})

const quoteErrors = [
  VisitNotFound,
  VisitTransitionInvalid,
  ReceiptAlreadyExists,
  CheckoutEncounterInvalid,
  CheckoutCoverageUnsupported,
  CheckoutPaymentInvalid,
]

/** 사유입니다. 감사·이력에 남습니다. */
const Reason = Schema.String.check(Schema.isMaxLength(500), Schema.isPattern(/\S/))

/**
 * 수납입니다 (front-desk.md 수납 커맨드, 환불과 정정). 견적과 수납 모두 `receipt:create`가 필요합니다. 견적은 수납
 * 화면이 그리는 값이라 수납과 같은 권한으로 봅니다. 조회는 `receipt:read`, 취소는 `receipt:void`, 정정은
 * `receipt:correct`입니다.
 */
export class ReceiptsApi extends HttpApiGroup.make('receipts')
  .add(
    HttpApiEndpoint.post('quoteCheckout', '/visits/:id::quote-checkout', {
      params,
      payload: Schema.Struct(options),
      success: CheckoutQuote,
      error: quoteErrors,
    })
      .annotate(Access, Access.requires('receipt:create'))
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.post('checkout', '/visits/:id::checkout', {
      params,
      headers: { 'idempotency-key': IdempotencyKey },
      payload: Schema.Struct({
        ...options,
        quoteId: QuoteId,
        excludeFromTaxDeduction: Schema.optionalKey(Schema.Boolean),
        memo: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(500))),
      }),
      success: CheckedOut,
      error: [...quoteErrors, QuoteStale, CheckoutRejected, IdempotencyKeyReused],
    })
      .annotate(Access, Access.requires('receipt:create'))
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.get('list', '/receipts', {
      query: {
        /** 수납한 날(병원 시간대)입니다. */
        date: Schema.optionalKey(LocalDate),
        patientId: Schema.optionalKey(PatientId),
        limit: Schema.optionalKey(
          Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 200 })),
        ),
        cursor: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(100))),
      },
      success: Schema.Struct({ items: Schema.Array(Receipt), nextCursor: Schema.NullOr(Schema.String) }),
      error: ValidationFailed,
    }).annotate(Access, Access.requires('receipt:read')),
    HttpApiEndpoint.get('get', '/receipts/:id', {
      params: { id: ReceiptId },
      success: Receipt,
      error: ReceiptNotFound,
    }).annotate(Access, Access.requires('receipt:read')),
    HttpApiEndpoint.post('void', '/receipts/:id::void', {
      params: { id: ReceiptId },
      payload: Schema.Struct({ reason: Reason }),
      success: Receipt,
      error: [ReceiptNotFound, ReceiptVoided, PaymentRefundRequired],
    })
      .annotate(Access, Access.requires('receipt:void'))
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.post('correct', '/receipts/:id::correct', {
      params: { id: ReceiptId },
      headers: { 'idempotency-key': IdempotencyKey },
      payload: Schema.Struct({
        paymentIds: options.paymentIds,
        payments: options.payments,
        useOverpaidCredit: options.useOverpaidCredit,
        writeOffRemainder: options.writeOffRemainder,
        acknowledge: options.acknowledge,
        excludeFromTaxDeduction: Schema.optionalKey(Schema.Boolean),
        memo: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(500))),
        reason: Reason,
      }),
      success: Receipt,
      error: [
        ReceiptNotFound,
        ReceiptVoided,
        CheckoutEncounterInvalid,
        CheckoutCoverageUnsupported,
        CheckoutPaymentInvalid,
        CheckoutRejected,
        IdempotencyKeyReused,
      ],
    })
      .annotate(Access, Access.requires('receipt:correct'))
      .annotate(HttpApi.PayloadParseOptions, strict),
  )
  .middleware(Authorization) {}
