import { Context, DateTime, Effect, Layer, Option, Schema } from 'effect'
import { Transaction } from '../../../shared/db/transaction.ts'
import { decisionContext } from '../../../shared/decision/decision-context.ts'
import { idempotent, IdempotencyKeyReused, IdempotencyStore } from '../../../shared/http/idempotency.ts'
import { isId, newId, newIds } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { ValidationFailed } from '../../../shared/problem/problem.ts'
import { EncounterRepository } from '../../clinical/encounters/encounter-repository.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { PatientRepository } from '../../patients/patient-repository.ts'
import { VisitRepository } from '../visits/visit-repository.ts'
import { Visit, VisitNotFound, VisitTransitionInvalid } from '../visits/visit.ts'
import { decideCheckout } from './checkout.aggregate.ts'
import type { CheckoutCommand } from './checkout.aggregate.ts'
import { toReceiptPayment } from './receipt-adjustments.ts'
import { checkoutable, decideCorrection, decideVoid, priceCheckout, voidable } from './receipt.aggregate.ts'
import type { CheckoutOptions, CorrectionInput, ReceiptIds } from './receipt.aggregate.ts'
import { chargesOf, quoteIdOf } from './receipt-charges.ts'
import { ReceiptRepository } from './receipt-repository.ts'
import {
  CheckoutCoverageUnsupported,
  CheckoutEncounterInvalid,
  CheckoutPaymentInvalid,
  CheckoutRejected,
  PaymentRefundRequired,
  QuoteStale,
  Receipt,
  ReceiptAlreadyExists,
  type ReceiptCharges,
  ReceiptNotFound,
  ReceiptVoided,
  recordOf,
} from './receipt.ts'

export type { CheckoutOptions }

export interface CheckoutInput extends CheckoutCommand {
  idempotencyKey: string
}

/** 정정 입력입니다. 진료는 앞 영수증의 진료 그대로이고, 결제와 결산 선택을 다시 받습니다. */
export interface CorrectInput extends CorrectionInput {
  idempotencyKey: string
}

export interface ReceiptListInput {
  date?: string
  patientId?: Id<'patient'>
  limit: number
  cursor?: string
}

/** 견적입니다. 수납과 같은 계산이고 아무것도 쓰지 않습니다. */
export interface CheckoutQuote {
  quoteId: Id<'quote'>
  encounters: ReadonlyArray<{ encounterId: Id<'encounter'>; due: { taxable: number; taxExempt: number } }>
  charges: ReceiptCharges
  settlement: {
    due: { taxable: number; taxExempt: number }
    effectiveDue: { taxable: number; taxExempt: number }
    entered: { taxable: number; taxExempt: number }
    received: { taxable: number; taxExempt: number }
    remaining: number
    result: Receipt['settlement']['result']
    outstanding: number
    overpaid: number
    writtenOff: number
    jejuSubsidy: number
    overpaidCreditApplied: { taxable: number; taxExempt: number }
  }
  errors: ReadonlyArray<CheckoutRejected['errors'][number]>
  warnings: ReadonlyArray<'OUTSTANDING'>
}

/** 수납한 영수증과 `COMPLETED`가 된 내원입니다. */
export const CheckedOut = Schema.Struct({ receipt: Receipt, visit: Visit }).annotate({
  description: '수납 결과입니다. 만든 영수증과 수납 뒤의 내원입니다.',
})
export type CheckedOut = typeof CheckedOut.Type

export type QuoteError =
  | VisitNotFound
  | VisitTransitionInvalid
  | ReceiptAlreadyExists
  | CheckoutEncounterInvalid
  | CheckoutCoverageUnsupported
  | CheckoutPaymentInvalid
export type CheckoutError =
  QuoteError | VisitTransitionInvalid | ReceiptAlreadyExists | QuoteStale | CheckoutRejected | IdempotencyKeyReused
export type VoidError = ReceiptNotFound | ReceiptVoided | PaymentRefundRequired
export type CorrectError =
  | ReceiptNotFound
  | ReceiptVoided
  | CheckoutEncounterInvalid
  | CheckoutCoverageUnsupported
  | CheckoutPaymentInvalid
  | CheckoutRejected
  | IdempotencyKeyReused

/**
 * 수납입니다 (front-desk.md 수납 커맨드, 환불과 정정). 견적(`quote`)·수납(`checkout`)·정정(`correct`)이 같은
 * 계산(`receipt.aggregate.ts`의 `settle`)을 씁니다.
 *
 * 금액은 일반 진료의 처방 금액과 건보·의료급여 진료의 급여 본인부담(`insuredCopay`)입니다. 선수금·과수납금 잔액은
 * 0으로 보고, 제주 지원금·패키지·등급 할인은 없습니다. 그 데이터가 생길 때 결산 입력에 더합니다.
 */
export class Receipts extends Context.Service<
  Receipts,
  {
    /**
     * 수납 견적입니다. 결산이 막을 이유가 있어도 200으로 `errors`·`warnings`를 담아 돌려줍니다. 수납할 수 없는 내원은
     * 수납과 같이 409 `VISIT_TRANSITION_INVALID`·`RECEIPT_ALREADY_EXISTS`입니다. 고른 진료가 이
     * 내원의 진료가 아니면 422 `CHECKOUT_ENCOUNTER_INVALID`, 급여 본인부담을 계산할 수 없는 진료는 422
     * `CHECKOUT_COVERAGE_UNSUPPORTED`입니다. 고른 결제(`paymentIds`)를 적용할 수 없으면 422
     * `CHECKOUT_PAYMENT_INVALID`입니다.
     */
    quote(visitId: Id<'visit'>, input: CheckoutOptions): Effect.Effect<CheckoutQuote, QuoteError, CurrentAccess>

    /**
     * 내원을 수납합니다. 견적과 같이 계산하고, 금액이 견적(`quoteId`)과 다르면 409 `QUOTE_STALE`, 결산이 막으면 422
     * `CHECKOUT_REJECTED`입니다. 통과하면 한 트랜잭션에서 내원을 `COMPLETED`로 옮기고(`visit.status_changed`)
     * 영수증과 `receipt.created`를 씁니다. 이미 수납했거나 취소한 내원은 409 `VISIT_TRANSITION_INVALID`, 다시 연
     * 내원에 유효한 영수증이 있으면 409 `RECEIPT_ALREADY_EXISTS`입니다.
     *
     * `idempotencyKey`로 24시간 안에 같은 요청이 다시 오면 처음 응답을 돌려줍니다.
     */
    checkout(visitId: Id<'visit'>, input: CheckoutInput): Effect.Effect<CheckedOut, CheckoutError, CurrentAccess>

    /** 고른 병원의 영수증 하나입니다. 취소한 영수증도 줍니다. */
    get(id: Id<'receipt'>): Effect.Effect<Receipt, ReceiptNotFound, CurrentAccess>

    /** 영수증 목록입니다. 만든 시각, ID 순서이고 취소한 영수증도 줍니다. 커서는 앞 쪽 마지막 영수증 ID입니다. */
    list(
      input: ReceiptListInput,
    ): Effect.Effect<{ items: ReadonlyArray<Receipt>; nextCursor: string | null }, ValidationFailed, CurrentAccess>

    /**
     * 잘못 입력한 수납을 취소합니다(`VOIDED`, `receipt.voided`). 서버 안에서 받은 결제(현금·계좌이체)는 받지 않은
     * 것으로 `VOIDED`가 됩니다. 카드·간편결제처럼 밖에서 취소해야 하는 결제가 남았으면 409
     * `PAYMENT_REFUND_REQUIRED`이고, 먼저 `:refund`로 전액 환불합니다. 이미 취소했으면 409 `RECEIPT_VOIDED`입니다.
     *
     * 내원은 그대로 둡니다. 다시 수납하려면 `:reopen` 뒤 수납합니다.
     */
    void(id: Id<'receipt'>, reason: string): Effect.Effect<Receipt, VoidError, CurrentAccess>

    /**
     * 수납을 정정합니다. 한 트랜잭션에서 앞 영수증을 취소하고 같은 진료로 새 영수증을 만듭니다(`correctionOf`).
     * 밖에서 취소해야 하는 결제는 환불하지 않고 새 영수증으로 옮기고, 서버 안에서 받은 결제는 취소한 뒤 요청의
     * `payments`로 다시 받습니다. 결산은 수납과 같아 막히면 422 `CHECKOUT_REJECTED`입니다. 내원 상태는 바꾸지
     * 않습니다.
     *
     * `idempotencyKey`로 24시간 안에 같은 요청이 다시 오면 처음 응답을 돌려줍니다.
     */
    correct(id: Id<'receipt'>, input: CorrectInput): Effect.Effect<Receipt, CorrectError, CurrentAccess>
  }
>()('hemr/front-desk/Receipts') {
  static readonly layer = Layer.effect(
    Receipts,
    Effect.gen(function* () {
      const repository = yield* ReceiptRepository
      const visits = yield* VisitRepository
      const encounters = yield* EncounterRepository
      const patients = yield* PatientRepository
      const transaction = yield* Transaction
      const idempotency = yield* IdempotencyStore

      const findVisit = (tenantId: Id<'tenant'>, id: Id<'visit'>) =>
        visits
          .findById(tenantId, id)
          .pipe(
            Effect.flatMap(Option.match({ onNone: () => Effect.fail(new VisitNotFound({})), onSome: Effect.succeed })),
          )

      const findReceipt = (tenantId: Id<'tenant'>, id: Id<'receipt'>) =>
        repository
          .findById(tenantId, id)
          .pipe(
            Effect.flatMap(
              Option.match({ onNone: () => Effect.fail(new ReceiptNotFound({})), onSome: Effect.succeed }),
            ),
          )

      /** 이 내원의 유효한 영수증입니다. */
      const activeReceiptOf = (visit: Visit) =>
        repository
          .listByVisit(visit.tenantId, visit.id)
          .pipe(Effect.map((listed) => listed.find((each) => each.status === 'ACTIVE') ?? null))

      /** 금액을 정하는 데 읽는 것: 환자의 진료, 생년월일, 요청한 미리 기록한 결제입니다. */
      const pricingFacts = (visit: Visit, paymentIds: ReadonlyArray<Id<'payment'>> | undefined) =>
        Effect.gen(function* () {
          const patient = Option.getOrUndefined(yield* patients.findById(visit.tenantId, visit.patientId))
          return {
            encounters: yield* encounters.listByPatient(visit.tenantId, visit.patientId),
            birthDate: patient?.birthDate ?? null,
            requestedPayments: yield* repository.listPayments(visit.tenantId, [...new Set(paymentIds ?? [])]),
          }
        })

      /** 새 영수증의 ID입니다. 결제 ID는 같은 시각이라 ID 순으로 읽히므로 요청 순서대로 커지는 ID를 줍니다. */
      const receiptIdsAt = (now: DateTime.Utc): ReceiptIds => {
        const millis = DateTime.toEpochMillis(now)
        return { receiptId: newId('receipt', millis), paymentIds: (count) => newIds('payment', count, millis) }
      }

      const quote = Effect.fn('Receipts.quote')(function* (visitId: Id<'visit'>, input: CheckoutOptions) {
        const access = yield* CurrentAccess
        const visit = yield* findVisit(access.tenantId, visitId)
        const activeReceipt = yield* activeReceiptOf(visit)
        // 거부할 요청이면 진료·결제를 읽지 않습니다. `priceCheckout`이 다시 봅니다
        yield* Effect.fromResult(checkoutable(visit, activeReceipt))
        const facts = yield* pricingFacts(visit, input.paymentIds)
        const { dues, settled } = yield* Effect.fromResult(priceCheckout(visit, activeReceipt, input, facts))
        const { settlement, errors } = settled
        return {
          quoteId: quoteIdOf(dues),
          encounters: dues.map((each) => ({
            encounterId: each.encounterId as Id<'encounter'>,
            due: each.due,
          })),
          charges: chargesOf(dues),
          settlement: {
            due: settlement.due,
            effectiveDue: settlement.effectiveDue,
            entered: settlement.entered,
            received: settlement.received,
            remaining: settlement.remaining,
            result: settlement.result,
            outstanding: settlement.outstanding,
            overpaid: settlement.overpaid,
            writtenOff: settlement.writtenOff,
            jejuSubsidy: settlement.jejuSubsidy,
            overpaidCreditApplied: settlement.overpaidCreditApplied,
          },
          errors,
          warnings: settlement.warnings,
        }
      })

      const checkout = Effect.fn('Receipts.checkout')(function* (visitId: Id<'visit'>, input: CheckoutInput) {
        const access = yield* CurrentAccess
        const now = yield* DateTime.now
        const context = decisionContext(access, now)
        const { idempotencyKey, ...request } = input
        return yield* transaction.run(
          idempotent(
            {
              tenantId: access.tenantId,
              key: idempotencyKey,
              operation: 'visits.checkout',
              request: { visitId, ...request },
              now: DateTime.formatIso(now),
              schema: CheckedOut,
            },
            // 판정과 내원 쓰기 사이에 다른 요청이 내원을 바꾸면(끼어들 수 있는 메모리 저장소에서만 생깁니다) 처음부터
            // 다시 읽고 판정해, 이미 수납한 내원은 409로 거부합니다. 세 번 넘게 어긋나면 결함입니다
            Effect.gen(function* () {
              const visit = yield* findVisit(access.tenantId, visitId)
              const activeReceipt = yield* activeReceiptOf(visit)
              yield* Effect.fromResult(checkoutable(visit, activeReceipt))
              const facts = { activeReceipt, ...(yield* pricingFacts(visit, input.paymentIds)) }
              const decided = yield* Effect.fromResult(
                decideCheckout(visit, request, facts, receiptIdsAt(now), context),
              )
              // 내원 쓰기를 먼저 해, 되돌리지 못하는 메모리 저장소에서도 영수증만 남지 않습니다. 영수증 쓰기는 같은
              // 트랜잭션에서 확인한 것(유효한 영수증 없음, 적용할 결제가 UNAPPLIED)이 그대로일 때만 성공합니다. SQL은
              // 트랜잭션이 하나씩 실행되어 그대로이고, 메모리는 그 사이에 다른 요청이 끼어들면 내원만 COMPLETED로 남을 수
              // 있습니다
              yield* visits.save(decided.visit.visit, { expectedVersion: visit.version, events: decided.visit.events })
              const { receipt } = decided
              yield* repository.commit({ ...receipt.changes, events: [receipt.event] })
              return { receipt: receipt.receipt, visit: decided.visit.visit }
            }).pipe(
              Effect.retry({ while: (error) => error._tag === 'VersionMismatch', times: 3 }),
              Effect.catchTag('VersionMismatch', Effect.die),
            ),
          ).pipe(Effect.provideService(IdempotencyStore, idempotency)),
        )
      })

      const get = Effect.fn('Receipts.get')(function* (id: Id<'receipt'>) {
        const access = yield* CurrentAccess
        return yield* findReceipt(access.tenantId, id)
      })

      const list = Effect.fn('Receipts.list')(function* (input: ReceiptListInput) {
        const access = yield* CurrentAccess
        // 커서는 앞 쪽 마지막 영수증의 ID입니다. 만든 시각은 서버에서 다시 읽습니다
        const cursor =
          input.cursor === undefined
            ? Option.none()
            : isId('receipt', input.cursor)
              ? yield* repository.findById(access.tenantId, input.cursor)
              : undefined
        if (cursor === undefined || (input.cursor !== undefined && Option.isNone(cursor))) {
          return yield* new ValidationFailed({ violations: [{ field: 'cursor', code: 'INVALID_VALUE' }] })
        }
        const rows = yield* repository.list(access.tenantId, {
          ...(input.date === undefined ? {} : { date: input.date }),
          ...(input.patientId === undefined ? {} : { patientId: input.patientId }),
          after: Option.match(cursor, { onNone: () => null, onSome: ({ createdAt, id }) => ({ createdAt, id }) }),
          limit: input.limit + 1,
        })
        const items = rows.slice(0, input.limit)
        const last = items.at(-1)
        return { items, nextCursor: rows.length > input.limit && last !== undefined ? last.id : null }
      })

      const voidOne = Effect.fn('Receipts.void')(function* (id: Id<'receipt'>, reason: string) {
        const access = yield* CurrentAccess
        const context = decisionContext(access, yield* DateTime.now)
        return yield* transaction.run(
          Effect.gen(function* () {
            const receipt = yield* findReceipt(access.tenantId, id)
            yield* Effect.fromResult(voidable(recordOf(receipt)))
            const payments = yield* repository.paymentsOf(access.tenantId, id)
            const decision = yield* Effect.fromResult(decideVoid(recordOf(receipt), payments, { reason }, context))
            yield* repository.commit({
              updateReceipts: [{ receipt: decision.receipt, expectedVersion: decision.expectedVersion }],
              updatePayments: decision.voided.map((each) => ({ payment: each, expectedVersion: each.version - 1 })),
              events: [decision.event],
            })
            const voided = new Map(decision.voided.map((each) => [each.id as string, each]))
            return {
              ...decision.receipt,
              payments: payments.map((each) => toReceiptPayment(voided.get(each.id) ?? each)),
            }
          }),
        )
      })

      const correct = Effect.fn('Receipts.correct')(function* (id: Id<'receipt'>, input: CorrectInput) {
        const access = yield* CurrentAccess
        const now = yield* DateTime.now
        const context = decisionContext(access, now)
        const { at } = context
        const { idempotencyKey, ...request } = input
        return yield* transaction.run(
          idempotent(
            {
              tenantId: access.tenantId,
              key: idempotencyKey,
              operation: 'receipts.correct',
              request: { receiptId: id, ...request },
              now: at,
              schema: Receipt,
            },
            Effect.gen(function* () {
              const receipt = yield* findReceipt(access.tenantId, id)
              yield* Effect.fromResult(voidable(recordOf(receipt)))
              // 내원은 지우지 않으므로 영수증의 내원은 늘 있습니다
              const visit = yield* findVisit(access.tenantId, receipt.visitId).pipe(Effect.orDie)
              const facts = {
                payments: yield* repository.paymentsOf(access.tenantId, id),
                visit,
                ...(yield* pricingFacts(visit, input.paymentIds)),
              }
              const { voided, created } = yield* Effect.fromResult(
                decideCorrection(recordOf(receipt), request, facts, receiptIdsAt(now), context),
              )
              yield* repository.commit({
                updateReceipts: [{ receipt: voided.receipt, expectedVersion: voided.expectedVersion }],
                insertReceipts: created.changes.insertReceipts,
                updatePayments: [
                  ...voided.voided.map((each) => ({ payment: each, expectedVersion: each.version - 1 })),
                  ...created.changes.updatePayments,
                ],
                insertPayments: created.changes.insertPayments,
                events: [voided.event, created.event],
              })
              return created.receipt
            }),
          ).pipe(Effect.provideService(IdempotencyStore, idempotency)),
        )
      })

      return Receipts.of({ quote, checkout, get, list, void: voidOne, correct })
    }),
  )
}
