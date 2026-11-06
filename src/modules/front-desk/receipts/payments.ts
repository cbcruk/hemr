import { Context, DateTime, Effect, Layer, Option } from 'effect'
import { Transaction } from '../../../shared/db/transaction.ts'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { idempotent, IdempotencyKeyReused, IdempotencyStore } from '../../../shared/http/idempotency.ts'
import { newId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { PatientRepository } from '../../patients/patient-repository.ts'
import { PatientNotFound } from '../../patients/patient.ts'
import { VisitRepository } from '../visits/visit-repository.ts'
import { VisitNotFound } from '../visits/visit.ts'
import { ReceiptRepository } from './receipt-repository.ts'
import {
  type ExternalPaymentMethod,
  Payment,
  PaymentNotFound,
  PaymentVisitMismatch,
  type SplitAmount,
} from './receipt.ts'

/** 밖에서 승인된 결제 하나입니다. */
export interface RecordPaymentInput {
  patientId: Id<'patient'>
  visitId?: Id<'visit'>
  method: ExternalPaymentMethod
  amount: typeof SplitAmount.Type
  processorRef: string
  idempotencyKey: string
}

export type RecordPaymentError = PatientNotFound | VisitNotFound | PaymentVisitMismatch | IdempotencyKeyReused

/**
 * 외부 승인 결제입니다 (front-desk.md 수납 커맨드). 카드 단말·간편결제처럼 수납 전에 돈이 오간 결제를 승인 직후
 * 영수증 없이(`UNAPPLIED`) 남겨, 수납이 실패해도 기록이 사라지지 않게 합니다. 적용은 수납의 `paymentIds`입니다.
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

      const record = Effect.fn('Payments.record')(function* (input: RecordPaymentInput) {
        const access = yield* CurrentAccess
        const at = DateTime.formatIso(yield* DateTime.now)
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
              if (input.visitId !== undefined) {
                const visit = yield* visits.findById(access.tenantId, input.visitId)
                if (Option.isNone(visit)) return yield* new VisitNotFound({})
                if (visit.value.patientId !== input.patientId) return yield* new PaymentVisitMismatch({})
              }
              const payment: Payment = {
                id: newId('payment'),
                tenantId: access.tenantId,
                patientId: input.patientId,
                visitId: input.visitId ?? null,
                receiptId: null,
                method: input.method,
                prepaidKind: null,
                amount: input.amount,
                processorRef: input.processorRef,
                status: 'UNAPPLIED',
                recordedBy: access.userId,
                createdAt: at,
                updatedAt: at,
                version: 1,
              }
              const event = domainEvent(
                'payment.recorded',
                payment.id,
                at,
                {
                  paymentId: payment.id,
                  patientId: payment.patientId,
                  visitId: payment.visitId,
                  method: payment.method,
                  amount: payment.amount,
                },
                { tenantId: access.tenantId, actor: { kind: 'USER', id: access.userId } },
              )
              yield* repository.recordPayment(payment, [event])
              return payment
            }),
          ).pipe(Effect.provideService(IdempotencyStore, idempotency)),
        )
      })

      const get = Effect.fn('Payments.get')(function* (id: Id<'payment'>) {
        const access = yield* CurrentAccess
        return yield* repository
          .findPayment(access.tenantId, id)
          .pipe(
            Effect.flatMap(
              Option.match({ onNone: () => Effect.fail(new PaymentNotFound({})), onSome: Effect.succeed }),
            ),
          )
      })

      return Payments.of({ record, get })
    }),
  )
}
