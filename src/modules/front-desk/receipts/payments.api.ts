import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'
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

/**
 * 결제입니다 (front-desk.md 수납 커맨드, 환불과 정정). 남기기는 수납과 같은 `receipt:create`, 보기는 `receipt:read`,
 * 환불은 `receipt:refund`가 필요합니다.
 */
export class PaymentsApi extends HttpApiGroup.make('payments')
  .add(
    HttpApiEndpoint.post('record', '/payments', {
      headers: { 'idempotency-key': IdempotencyKey },
      payload: Schema.Struct({
        patientId: PatientId,
        visitId: Schema.optionalKey(VisitId),
        method: ExternalPaymentMethod,
        amount: Schema.Struct({ taxable: Won, taxExempt: Won }).check(isPositive),
        processorRef: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100), Schema.isTrimmed()),
      }),
      success: Payment,
      error: [PatientNotFound, VisitNotFound, PaymentVisitMismatch, IdempotencyKeyReused],
    })
      .annotate(Access, Access.requires('receipt:create'))
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
    HttpApiEndpoint.get('list', '/payments', {
      query: {
        /** 수납현황의 미적용 결제는 `UNAPPLIED`입니다. */
        status: Schema.optionalKey(PaymentStatus),
        patientId: Schema.optionalKey(PatientId),
        limit: Schema.optionalKey(
          Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 200 })),
        ),
        cursor: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(100))),
      },
      success: Schema.Struct({ items: Schema.Array(Payment), nextCursor: Schema.NullOr(Schema.String) }),
      error: ValidationFailed,
    }).annotate(Access, Access.requires('receipt:read')),
    HttpApiEndpoint.get('get', '/payments/:id', {
      params: { id: PaymentId },
      success: Payment,
      error: PaymentNotFound,
    }).annotate(Access, Access.requires('receipt:read')),
    HttpApiEndpoint.post('refund', '/payments/:id::refund', {
      params: { id: PaymentId },
      headers: { 'idempotency-key': IdempotencyKey },
      payload: Schema.Struct({
        amount: Schema.Struct({ taxable: Won, taxExempt: Won }).check(isPositive),
        refundMethod: RefundMethod,
        reason: Schema.String.check(Schema.isMaxLength(500), Schema.isPattern(/\S/)),
        writeOff: Schema.optionalKey(Schema.Boolean),
      }),
      success: Payment,
      error: [PaymentNotFound, PaymentNotRefundable, RefundRejected, IdempotencyKeyReused],
    })
      .annotate(Access, Access.requires('receipt:refund'))
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
  )
  .middleware(Authorization) {}
