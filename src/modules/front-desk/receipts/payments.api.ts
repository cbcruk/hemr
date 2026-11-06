import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'
import { IdempotencyKey, IdempotencyKeyReused } from '../../../shared/http/idempotency.ts'
import { Access } from '../../identity/auth/access.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import { PatientId, PatientNotFound } from '../../patients/patient.ts'
import { VisitId, VisitNotFound } from '../visits/visit.ts'
import { ExternalPaymentMethod, Payment, PaymentId, PaymentNotFound, PaymentVisitMismatch, Won } from './receipt.ts'

/** 0원 결제는 남길 일이 없습니다. */
const isPositive = Schema.makeFilter(
  (amount: { readonly taxable: number; readonly taxExempt: number }) => amount.taxable + amount.taxExempt > 0,
  { title: 'positive amount' },
)

/**
 * 외부 승인 결제입니다 (front-desk.md 수납 커맨드). 남기기는 수납과 같은 `receipt:create`, 보기는 `receipt:read`가
 * 필요합니다.
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
    HttpApiEndpoint.get('get', '/payments/:id', {
      params: { id: PaymentId },
      success: Payment,
      error: PaymentNotFound,
    }).annotate(Access, Access.requires('receipt:read')),
  )
  .middleware(Authorization) {}
