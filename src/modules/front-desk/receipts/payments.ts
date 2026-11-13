import { Context, DateTime, Effect, Layer, Option } from 'effect'
import { Transaction } from '../../../shared/db/transaction.ts'
import { decisionContext } from '../../../shared/decision/decision-context.ts'
import { idempotent, IdempotencyKeyReused, IdempotencyStore } from '../../../shared/http/idempotency.ts'
import { isId, newId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { ValidationFailed } from '../../../shared/problem/problem.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { PatientRepository } from '../../patients/patient-repository.ts'
import { PatientNotFound } from '../../patients/patient.ts'
import { VisitRepository } from '../visits/visit-repository.ts'
import { VisitNotFound } from '../visits/visit.ts'
import { decideRecordPayment, decideRefund } from './payment.aggregate.ts'
import type { RecordPaymentCommand, RefundCommand } from './payment.aggregate.ts'
import { ReceiptRepository } from './receipt-repository.ts'
import {
  Payment,
  PaymentNotFound,
  PaymentNotRefundable,
  PaymentVisitMismatch,
  recordOf,
  RefundRejected,
} from './receipt.ts'

/** 밖에서 승인된 결제 하나입니다. */
export interface RecordPaymentInput extends RecordPaymentCommand {
  idempotencyKey: string
}

export interface RefundInput extends RefundCommand {
  idempotencyKey: string
}

export interface PaymentListInput {
  status?: Payment['status']
  patientId?: Id<'patient'>
  limit: number
  cursor?: string
}

export type RecordPaymentError = PatientNotFound | VisitNotFound | PaymentVisitMismatch | IdempotencyKeyReused
export type RefundError = PaymentNotFound | PaymentNotRefundable | RefundRejected | IdempotencyKeyReused

/**
 * 결제입니다 (front-desk.md 수납 커맨드, 환불과 정정). 카드 단말·간편결제처럼 수납 전에 돈이 오간 결제를 승인 직후
 * 영수증 없이(`UNAPPLIED`) 남겨, 수납이 실패해도 기록이 사라지지 않게 합니다. 적용은 수납의 `paymentIds`입니다.
 * 환불은 결제 하나씩 받습니다.
 */
export class Payments extends Context.Service<
  Payments,
  {
    /**
     * 결제를 `UNAPPLIED`로 남기고 `payment.recorded`를 냅니다. 환자가 없으면 404 `PATIENT_NOT_FOUND`, 내원이 없으면
     * 404 `VISIT_NOT_FOUND`, 내원이 다른 환자의 내원이면 422 `PAYMENT_VISIT_MISMATCH`입니다. 내원의 상태는 보지
     * 않습니다. 돈은 이미 오갔으므로 취소한 내원의 결제도 남깁니다.
     *
     * `idempotencyKey`로 24시간 안에 같은 요청이 다시 오면 처음 응답을 돌려줍니다.
     */
    record(input: RecordPaymentInput): Effect.Effect<Payment, RecordPaymentError, CurrentAccess>
    get(id: Id<'payment'>): Effect.Effect<Payment, PaymentNotFound, CurrentAccess>

    /** 결제 목록입니다. 받은 시각, ID 순서입니다. 커서는 앞 쪽 마지막 결제 ID입니다. */
    list(
      input: PaymentListInput,
    ): Effect.Effect<{ items: ReadonlyArray<Payment>; nextCursor: string | null }, ValidationFailed, CurrentAccess>

    /**
     * 결제 하나를 환불하고 `payment.refunded`를 냅니다. 환불 수단은 원 결제 수단에 맞아야 하고 과세·비과세 각각 남은
     * 금액까지만 받습니다(422 `REFUND_REJECTED`). 미적용 결제는 전액만 받습니다. 이미 전액 환불했거나 취소한 결제는
     * 409 `PAYMENT_NOT_REFUNDABLE`입니다.
     *
     * 영수증에 적용한 결제면 같은 트랜잭션에서 영수증의 결산을 다시 판정합니다(`settlementAfterRefund`).
     *
     * `idempotencyKey`로 24시간 안에 같은 요청이 다시 오면 처음 응답을 돌려줍니다.
     */
    refund(id: Id<'payment'>, input: RefundInput): Effect.Effect<Payment, RefundError, CurrentAccess>
  }
>()('hemr/front-desk/Payments') {
  static readonly layer = Layer.effect(
    Payments,
    Effect.gen(function* () {
      const repository = yield* ReceiptRepository
      const patients = yield* PatientRepository
      const visits = yield* VisitRepository
      const transaction = yield* Transaction
      const idempotency = yield* IdempotencyStore

      const findPayment = (tenantId: Id<'tenant'>, id: Id<'payment'>) =>
        repository
          .findPayment(tenantId, id)
          .pipe(
            Effect.flatMap(
              Option.match({ onNone: () => Effect.fail(new PaymentNotFound({})), onSome: Effect.succeed }),
            ),
          )

      const record = Effect.fn('Payments.record')(function* (input: RecordPaymentInput) {
        const access = yield* CurrentAccess
        const context = decisionContext(access, yield* DateTime.now)
        const { at } = context
        const { idempotencyKey, ...request } = input
        return yield* transaction.run(
          idempotent(
            {
              tenantId: access.tenantId,
              key: idempotencyKey,
              operation: 'payments.record',
              request,
              now: at,
              schema: Payment,
            },
            Effect.gen(function* () {
              if (Option.isNone(yield* patients.findById(access.tenantId, input.patientId))) {
                return yield* new PatientNotFound({})
              }
              const visit =
                input.visitId === undefined
                  ? null
                  : Option.getOrNull(yield* visits.findById(access.tenantId, input.visitId))
              if (input.visitId !== undefined && visit === null) return yield* new VisitNotFound({})
              const { payment, event } = yield* Effect.fromResult(
                decideRecordPayment(request, visit, newId('payment'), context),
              )
              yield* repository.commit({ insertPayments: [payment], events: [event] })
              return payment
            }),
          ).pipe(Effect.provideService(IdempotencyStore, idempotency)),
        )
      })

      const get = Effect.fn('Payments.get')(function* (id: Id<'payment'>) {
        const access = yield* CurrentAccess
        return yield* findPayment(access.tenantId, id)
      })

      const list = Effect.fn('Payments.list')(function* (input: PaymentListInput) {
        const access = yield* CurrentAccess
        // 커서는 앞 쪽 마지막 결제의 ID입니다. 받은 시각은 서버에서 다시 읽습니다
        const cursor =
          input.cursor === undefined
            ? Option.none()
            : isId('payment', input.cursor)
              ? yield* repository.findPayment(access.tenantId, input.cursor)
              : undefined
        if (cursor === undefined || (input.cursor !== undefined && Option.isNone(cursor))) {
          return yield* new ValidationFailed({ violations: [{ field: 'cursor', code: 'INVALID_VALUE' }] })
        }
        const rows = yield* repository.searchPayments(access.tenantId, {
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(input.patientId === undefined ? {} : { patientId: input.patientId }),
          after: Option.match(cursor, { onNone: () => null, onSome: ({ createdAt, id }) => ({ createdAt, id }) }),
          limit: input.limit + 1,
        })
        const items = rows.slice(0, input.limit)
        const last = items.at(-1)
        return { items, nextCursor: rows.length > input.limit && last !== undefined ? last.id : null }
      })

      const refund = Effect.fn('Payments.refund')(function* (id: Id<'payment'>, input: RefundInput) {
        const access = yield* CurrentAccess
        const context = decisionContext(access, yield* DateTime.now)
        const { at } = context
        const { idempotencyKey, ...request } = input
        return yield* transaction.run(
          idempotent(
            {
              tenantId: access.tenantId,
              key: idempotencyKey,
              operation: 'payments.refund',
              request: { paymentId: id, ...request },
              now: at,
              schema: Payment,
            },
            Effect.gen(function* () {
              const payment = yield* findPayment(access.tenantId, id)
              // 영수증은 지우지 않으므로 적용한 결제의 영수증은 늘 있습니다
              const receipt =
                payment.receiptId === null
                  ? null
                  : recordOf(
                      yield* repository
                        .findById(access.tenantId, payment.receiptId)
                        .pipe(Effect.map(Option.getOrThrow), Effect.orDie),
                    )
              const decision = yield* Effect.fromResult(decideRefund(payment, receipt, request, context))
              yield* repository.commit({
                updateReceipts: decision.receipt === null ? [] : [decision.receipt],
                updatePayments: [{ payment: decision.payment, expectedVersion: decision.expectedVersion }],
                events: [decision.event],
              })
              return decision.payment
            }),
          ).pipe(Effect.provideService(IdempotencyStore, idempotency)),
        )
      })

      return Payments.of({ record, get, list, refund })
    }),
  )
}
