import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'
import { IdempotencyKey, IdempotencyKeyReused } from '../../../shared/http/idempotency.ts'
import { EncounterId } from '../../clinical/encounters/encounter-id.ts'
import { Access } from '../../identity/auth/access.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import { VisitId, VisitNotFound, VisitTransitionInvalid } from '../visits/visit.ts'
import {
  CheckoutCoverageUnsupported,
  CheckoutEncounterInvalid,
  CheckoutErrorCode,
  CheckoutPaymentInvalid,
  CheckoutRejected,
  PaymentId,
  PaymentMethod,
  PrepaidKind,
  QuoteId,
  QuoteStale,
  ReceiptAlreadyExists,
  ReceiptCharges,
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

/**
 * 수납입니다 (front-desk.md 수납 커맨드). 견적과 수납 모두 `receipt:create`가 필요합니다. 견적은 수납 화면이 그리는
 * 값이라 수납과 같은 권한으로 봅니다.
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
  )
  .middleware(Authorization) {}
