import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from 'effect/http-api'
import { IdempotencyKey, IdempotencyKeyReused } from '../../../shared/http/idempotency.ts'
import { PageCursor, PageLimit } from '../../../shared/http/paging.ts'
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
  CheckoutWarningCode,
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

const PaymentInput = Schema.Struct({
  method: PaymentMethod,
  prepaidKind: Schema.optionalKey(PrepaidKind),
  amount: Schema.Struct({ taxable: Won, taxExempt: Won }),
}).annotate({
  description:
    '수납 요청 안에서 받는 결제 하나입니다. 서버 안에서 끝나는 현금·계좌이체·선수금만 받고, 그 밖의 수단은 결산 오류 `PAYMENT_METHOD_NOT_ALLOWED`입니다. 선수금은 `prepaidKind`가 필요하고, 지금은 선수금 잔액이 없어 0원이 아니면 늘 `PREPAID_BALANCE_INSUFFICIENT`입니다. 0원 결제는 받되 기록하지 않습니다.',
})

/** 견적과 수납이 같이 받는 필드입니다. */
const options = {
  encounterIds: Schema.optionalKey(
    Schema.Array(EncounterId)
      .check(Schema.isMinLength(1), Schema.isMaxLength(20))
      .annotate({ description: '수납할 진료입니다. 없으면 이 내원의 진료 전부입니다.' }),
  ),
  paymentIds: Schema.optionalKey(
    Schema.Array(PaymentId).check(Schema.isMaxLength(20)).annotate({
      description:
        '미리 기록한 외부 승인 결제(`POST /payments`)입니다. 이 환자의 `UNAPPLIED` 결제여야 하고, 결제에 내원이 있으면 이 내원이어야 합니다(아니면 422 `CHECKOUT_PAYMENT_INVALID`).',
    }),
  ),
  payments: Schema.optionalKey(Schema.Array(PaymentInput).check(Schema.isMaxLength(20))),
  useOverpaidCredit: Schema.optionalKey(
    Schema.NullOr(Schema.Literals(['TAX_EXEMPT', 'TAXABLE'])).annotate({
      description:
        '과수납금을 쓸 쪽(비과세·과세)입니다. 한쪽에만 쓰고, 그쪽 받을 금액까지만 씁니다. 지금은 과수납 잔액이 없어 효과가 없습니다.',
    }),
  ),
  writeOffRemainder: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        '남은 금액을 손비로 둡니다. 과수납이면 결산 오류 `WRITE_OFF_OVERPAID`, 남은 금액이 0이면 무시합니다.',
    }),
  ),
  acknowledge: Schema.optionalKey(
    Schema.Array(CheckoutWarningCode).check(Schema.isMaxLength(1)).annotate({
      description:
        '확인하고 넘길 경고입니다. 결제(`paymentIds`·`payments`, 0원 제외) 없이 남은 금액을 미수로 남길 때 보냅니다.',
    }),
  ),
}

const CheckoutQuote = Schema.Struct({
  quoteId: QuoteId,
  encounters: Schema.Array(Schema.Struct({ encounterId: EncounterId, due: SplitAmount })).annotate({
    description: '진료별 받을 금액입니다.',
  }),
  charges: ReceiptCharges,
  settlement: Schema.Struct({
    due: SplitAmount,
    effectiveDue: SplitAmount,
    entered: SplitAmount,
    received: SplitAmount,
    remaining: Schema.Int.annotate({ description: '`due − received`를 과세·비과세 합으로 본 남은 금액입니다.' }),
    result: SettlementResult,
    outstanding: Schema.Int,
    overpaid: Schema.Int,
    writtenOff: Schema.Int,
    jejuSubsidy: Schema.Int.annotate({
      description: '서버가 만드는 제주 지원금 결제(비과세)입니다. 지금은 늘 0입니다.',
    }),
    overpaidCreditApplied: SplitAmount,
  }).annotate({
    description:
      '결산 미리보기입니다. `due`는 고른 진료의 받을 금액, `effectiveDue`는 제주 지원금·과수납금(`overpaidCreditApplied`)을 뺀 금액, `entered`는 결제(`paymentIds`의 남은 금액과 `payments`)의 합, `received`는 그 합에 제주 지원금·과수납금을 더한 받은 금액입니다.',
  }),
  errors: Schema.Array(CheckoutErrorCode),
  warnings: Schema.Array(CheckoutWarningCode).annotate({
    description: '확인을 받지 않은 경고입니다. 있으면 수납이 422입니다.',
  }),
}).annotate({
  description:
    '수납 견적입니다. 결산이 막을 이유가 있어도 200으로 `errors`·`warnings`에 담고, 같은 입력의 수납은 422 `CHECKOUT_REJECTED`입니다.',
})

const quoteErrors = [
  VisitNotFound,
  VisitTransitionInvalid,
  ReceiptAlreadyExists,
  CheckoutEncounterInvalid,
  CheckoutCoverageUnsupported,
  CheckoutPaymentInvalid,
]

const Reason = Schema.String.check(Schema.isMaxLength(500), Schema.isPattern(/\S/)).annotate({
  description: '사유입니다. 500자까지이고 공백만은 안 됩니다. 감사·이력에 남습니다.',
})
const Memo = Schema.String.check(Schema.isMaxLength(500)).annotate({ description: '메모입니다. 500자까지입니다.' })
const ExcludeFromTaxDeduction = Schema.Boolean.annotate({ description: '연말정산 의료비 공제에서 뺍니다.' })

/**
 * 수납 그룹의 구현 메모입니다. API 설명은 `OpenApi.Description`에 있습니다.
 *
 * 견적과 수납 모두 `receipt:create`가 필요합니다. 견적은 수납
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
      .annotate(OpenApi.Summary, '수납 견적')
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.post('checkout', '/visits/:id::checkout', {
      params,
      headers: { 'idempotency-key': IdempotencyKey },
      payload: Schema.Struct({
        ...options,
        quoteId: QuoteId,
        excludeFromTaxDeduction: Schema.optionalKey(ExcludeFromTaxDeduction),
        memo: Schema.optionalKey(Memo),
      }),
      success: CheckedOut,
      error: [...quoteErrors, QuoteStale, CheckoutRejected, IdempotencyKeyReused],
    })
      .annotate(Access, Access.requires('receipt:create'))
      .annotate(OpenApi.Summary, '수납')
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.get('list', '/receipts', {
      query: {
        date: Schema.optionalKey(LocalDate.annotate({ description: '수납한 날(병원 시간대)입니다.' })),
        patientId: Schema.optionalKey(PatientId),
        limit: Schema.optionalKey(PageLimit),
        cursor: Schema.optionalKey(PageCursor(100)),
      },
      success: Schema.Struct({ items: Schema.Array(Receipt), nextCursor: Schema.NullOr(Schema.String) }),
      error: ValidationFailed,
    })
      .annotate(Access, Access.requires('receipt:read'))
      .annotate(OpenApi.Summary, '영수증 목록 (만든 순서, 취소 포함)'),
    HttpApiEndpoint.get('get', '/receipts/:id', {
      params: { id: ReceiptId },
      success: Receipt,
      error: ReceiptNotFound,
    })
      .annotate(Access, Access.requires('receipt:read'))
      .annotate(OpenApi.Summary, '영수증 조회'),
    HttpApiEndpoint.post('void', '/receipts/:id::void', {
      params: { id: ReceiptId },
      payload: Schema.Struct({ reason: Reason }).annotate({
        description:
          '수납 취소 본문입니다. 현금·계좌이체처럼 서버 안에서 받은 결제는 받지 않은 것으로 `VOIDED`가 됩니다. 내원 상태는 바꾸지 않으므로, 다시 수납하려면 처방을 고친 뒤 내원을 다시 열고(`:reopen`) 수납합니다.',
      }),
      success: Receipt,
      error: [ReceiptNotFound, ReceiptVoided, PaymentRefundRequired],
    })
      .annotate(Access, Access.requires('receipt:void'))
      .annotate(OpenApi.Summary, '수납 취소')
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
        excludeFromTaxDeduction: Schema.optionalKey(ExcludeFromTaxDeduction),
        memo: Schema.optionalKey(Memo),
        reason: Reason,
      }).annotate({
        description:
          '수납 정정 본문입니다. 앞 영수증을 취소하고 같은 진료로 새 영수증을 만듭니다. 카드·간편결제처럼 밖에서 승인한 결제는 환불하지 않고 남은 금액으로 새 영수증에 옮기고, 현금·계좌이체처럼 서버 안에서 받은 결제는 `VOIDED`가 되므로 `payments`로 다시 보냅니다. 청구 금액이 바뀌지 않아 `quoteId`는 받지 않습니다. 새 영수증의 수납일은 정정한 날입니다. 보내지 않은 `memo`·`excludeFromTaxDeduction`은 앞 영수증 것을 이어받습니다.',
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
      .annotate(OpenApi.Summary, '수납 정정')
      .annotate(HttpApi.PayloadParseOptions, strict),
  )
  .annotate(
    OpenApi.Description,
    '수납입니다. 견적(`:quote-checkout`)으로 금액과 `quoteId`를 받고, 같은 입력과 `quoteId`로 수납(`:checkout`)합니다. 견적 뒤 청구 금액이 바뀌면 409 `QUOTE_STALE`이고 새 견적으로 다시 수납합니다. 내원 하나에 유효한 영수증은 하나입니다. 영수증은 지우지 않고 취소(`:void`)합니다. 카드·간편결제처럼 밖에서 취소해야 하는 결제가 남았으면 먼저 그 결제를 환불합니다(409 `PAYMENT_REFUND_REQUIRED`). 결제만 바꿀 때는 정정(`:correct`)합니다. 수납·정정은 `Idempotency-Key`가 필수입니다. 다른 병원의 영수증·내원은 없는 것과 같이 404입니다.',
  )
  .middleware(Authorization) {}
