import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from 'effect/http-api'
import { IdempotencyKey, IdempotencyKeyReused } from '../../../shared/http/idempotency.ts'
import { ValidationFailed } from '../../../shared/problem/problem.ts'
import { Access } from '../../identity/auth/access.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import { PatientId, PatientNotFound } from '../../patients/patient.ts'
import { VisitId, VisitNotFound } from '../visits/visit.ts'
import {
  ExternalPaymentMethod,
  Payment,
  PaymentId,
  PaymentNotFound,
  PaymentNotRefundable,
  PaymentStatus,
  PaymentVisitMismatch,
  RefundMethod,
  RefundRejected,
  Won,
} from './receipt.ts'

/** 0원 결제는 남길 일이 없습니다. */
const isPositive = Schema.makeFilter(
  (amount: { readonly taxable: number; readonly taxExempt: number }) => amount.taxable + amount.taxExempt > 0,
  { title: 'positive amount' },
)

// 직접 만든 검사(`isPositive`) 뒤에 단 설명은 문서에서 빠지므로 앞에 답니다
const PositiveAmount = (description: string) =>
  Schema.Struct({ taxable: Won, taxExempt: Won }).annotate({ description }).check(isPositive)

const Limit = Schema.String.annotate({ description: '한 쪽의 개수입니다. 1–200입니다.' }).pipe(
  Schema.decodeTo(Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 200 }))),
)

/**
 * 결제 그룹의 구현 메모입니다. API 설명은 `OpenApi.Description`에 있습니다.
 *
 * 남기기는 수납과 같은 `receipt:create`, 보기는 `receipt:read`,
 * 환불은 `receipt:refund`가 필요합니다.
 */
export class PaymentsApi extends HttpApiGroup.make('payments')
  .add(
    HttpApiEndpoint.post('record', '/payments', {
      headers: { 'idempotency-key': IdempotencyKey },
      payload: Schema.Struct({
        patientId: PatientId,
        // 내원 상태는 보지 않습니다. 돈은 이미 오갔으므로 수납했거나 취소한 내원의 결제도 남깁니다
        visitId: Schema.optionalKey(VisitId),
        method: ExternalPaymentMethod,
        amount: PositiveAmount('결제 금액입니다. 과세·비과세 합이 0보다 커야 합니다.'),
        processorRef: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100), Schema.isTrimmed()).annotate({
          description: '카드 승인번호처럼 밖에서 받은 참조입니다. 1–100자이고 앞뒤 공백이 없어야 합니다.',
        }),
      }).annotate({
        description:
          '외부 승인 결제 본문입니다. 내원을 정하면 그 환자의 내원이어야 하고(아니면 422 `PAYMENT_VISIT_MISMATCH`), 그 내원의 수납에만 적용합니다.',
      }),
      success: Payment,
      error: [PatientNotFound, VisitNotFound, PaymentVisitMismatch, IdempotencyKeyReused],
    })
      .annotate(Access, Access.requires('receipt:create'))
      .annotate(OpenApi.Summary, '외부 승인 결제 남기기')
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
    HttpApiEndpoint.get('list', '/payments', {
      query: {
        // 수납현황의 미적용 결제는 `UNAPPLIED`입니다
        status: Schema.optionalKey(PaymentStatus),
        patientId: Schema.optionalKey(PatientId),
        limit: Schema.optionalKey(Limit),
        cursor: Schema.optionalKey(
          Schema.String.check(Schema.isMaxLength(100)).annotate({ description: '앞 쪽 응답의 `nextCursor`입니다.' }),
        ),
      },
      success: Schema.Struct({ items: Schema.Array(Payment), nextCursor: Schema.NullOr(Schema.String) }),
      error: ValidationFailed,
    })
      .annotate(Access, Access.requires('receipt:read'))
      .annotate(OpenApi.Summary, '결제 목록 (받은 순서)'),
    HttpApiEndpoint.get('get', '/payments/:id', {
      params: { id: PaymentId },
      success: Payment,
      error: PaymentNotFound,
    })
      .annotate(Access, Access.requires('receipt:read'))
      .annotate(OpenApi.Summary, '결제 조회'),
    HttpApiEndpoint.post('refund', '/payments/:id::refund', {
      params: { id: PaymentId },
      headers: { 'idempotency-key': IdempotencyKey },
      payload: Schema.Struct({
        amount: PositiveAmount('환불 금액입니다. 과세·비과세 각각 남은 금액까지입니다.'),
        refundMethod: RefundMethod,
        reason: Schema.String.check(Schema.isMaxLength(500), Schema.isPattern(/\S/)).annotate({
          description: '환불 사유입니다. 500자까지이고 공백만은 안 됩니다.',
        }),
        writeOff: Schema.optionalKey(
          Schema.Boolean.annotate({
            description: '환불로 늘어난 남은 금액을 미수 대신 손비로 둡니다. 수납 전 결제의 환불에서는 무시합니다.',
          }),
        ),
      }).annotate({
        description:
          '결제 환불 본문입니다. 수납 전(`UNAPPLIED`) 결제는 전액만 환불합니다. 수납에 적용한 결제를 환불하면 영수증 결산을 다시 판정합니다.',
      }),
      success: Payment,
      error: [PaymentNotFound, PaymentNotRefundable, RefundRejected, IdempotencyKeyReused],
    })
      .annotate(Access, Access.requires('receipt:refund'))
      .annotate(OpenApi.Summary, '결제 환불')
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
  )
  .annotate(
    OpenApi.Description,
    '결제입니다. 카드·간편결제처럼 밖에서 승인된 결제는 승인 직후 `POST /payments`로 수납 전(`UNAPPLIED`) 상태로 남기고, 수납의 `paymentIds`로 적용합니다. 수납이 실패해도 결제 기록은 남습니다. 환불은 결제 하나씩 기록을 덧붙입니다. 남기기·환불은 `Idempotency-Key`가 필수이고, 다시 보내면 처음 응답을 돌려주므로 지금 상태는 `GET`으로 봅니다. 다른 병원의 결제는 없는 것과 같이 404입니다.',
  )
  .middleware(Authorization) {}
