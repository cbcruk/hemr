import { Context, DateTime, Effect, Layer, Option, Schema } from 'effect'
import { Transaction } from '../../../shared/db/transaction.ts'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { idempotent, IdempotencyKeyReused, IdempotencyStore } from '../../../shared/http/idempotency.ts'
import { newId, newIds } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { EncounterRepository } from '../../clinical/encounters/encounter-repository.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { VisitRepository } from '../visits/visit-repository.ts'
import { Visit, VisitNotFound, VisitTransitionInvalid } from '../visits/visit.ts'
import { Visits } from '../visits/visits.ts'
import { normalizedPayments, settleCheckout } from './checkout-settlement.ts'
import type { CheckoutPayment, EncounterDue, OverpaidCreditTarget, PaymentMethod } from './checkout-settlement.types.ts'
import { chargesOf, encounterDue, quoteIdOf } from './receipt-charges.ts'
import { ReceiptRepository } from './receipt-repository.ts'
import {
  byRecorded,
  CheckoutCoverageUnsupported,
  CheckoutEncounterInvalid,
  CheckoutPaymentInvalid,
  CheckoutRejected,
  ExternalPaymentMethod,
  QuoteStale,
  Receipt,
  ReceiptAlreadyExists,
  type ReceiptCharges,
} from './receipt.ts'

/** 견적과 수납이 같이 받는 입력입니다. */
export interface CheckoutOptions {
  /** 수납할 진료입니다. 없으면 이 내원의 철회하지 않은 진료 전부입니다. */
  encounterIds?: ReadonlyArray<Id<'encounter'>>
  /** 미리 기록한 외부 승인 결제(`POST /payments`)입니다. 이 환자의 `UNAPPLIED` 결제여야 합니다. */
  paymentIds?: ReadonlyArray<Id<'payment'>>
  /** 서버 안에서 끝나는 결제(현금·계좌이체·선수금)입니다. */
  payments?: ReadonlyArray<CheckoutPayment>
  useOverpaidCredit?: OverpaidCreditTarget | null
  writeOffRemainder?: boolean
  acknowledge?: ReadonlyArray<'OUTSTANDING'>
}

export interface CheckoutInput extends CheckoutOptions {
  quoteId: Id<'quote'>
  excludeFromTaxDeduction?: boolean
  memo?: string
  idempotencyKey: string
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
export const CheckedOut = Schema.Struct({ receipt: Receipt, visit: Visit })
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

/** 밖에서 승인되는 결제 수단입니다. 수납 요청의 `payments`로 보내면 `PAYMENT_METHOD_NOT_ALLOWED`입니다. */
const EXTERNAL_METHODS: ReadonlySet<PaymentMethod> = new Set(ExternalPaymentMethod.literals)

/**
 * 수납입니다 (front-desk.md 수납 커맨드). 견적(`quote`)과 수납(`checkout`)이 같은 계산(`settleCheckout`)을 씁니다.
 *
 * 지금은 일반(`SELF_PAY`) 진료의 처방 금액만 계산합니다. 선수금·과수납금 잔액은 0으로 보고, 제주 지원금·패키지·등급
 * 할인은 없습니다. 그 데이터가 생길 때 결산 입력에 더합니다.
 */
export class Receipts extends Context.Service<
  Receipts,
  {
    /**
     * 수납 견적입니다. 결산이 막을 이유가 있어도 200으로 `errors`·`warnings`를 담아 돌려줍니다. 수납할 수 없는 내원은
     * 수납과 같이 409 `VISIT_TRANSITION_INVALID`·`RECEIPT_ALREADY_EXISTS`입니다. 고른 진료가 이
     * 내원의 진료가 아니면 422 `CHECKOUT_ENCOUNTER_INVALID`, 처방이 있는 보험 진료는 422
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
  }
>()('hemr/front-desk/Receipts') {
  static readonly layer = Layer.effect(
    Receipts,
    Effect.gen(function* () {
      const repository = yield* ReceiptRepository
      const visits = yield* VisitRepository
      const visitCommands = yield* Visits
      const encounters = yield* EncounterRepository
      const transaction = yield* Transaction
      const idempotency = yield* IdempotencyStore

      const findVisit = (tenantId: Id<'tenant'>, id: Id<'visit'>) =>
        visits
          .findById(tenantId, id)
          .pipe(
            Effect.flatMap(Option.match({ onNone: () => Effect.fail(new VisitNotFound({})), onSome: Effect.succeed })),
          )

      /**
       * 수납할 수 있는 내원인지입니다. 이미 수납했거나 취소한 내원, 다시 열었지만 유효한 영수증이 남은 내원은 금액을
       * 보기 전에 거절합니다. 그런 내원의 견적은 받을 수 없는 금액을 보여 주기 때문입니다.
       */
      const requireCheckoutable = (visit: Visit) =>
        Effect.gen(function* () {
          if (visit.status === 'COMPLETED' || visit.status === 'CANCELED') {
            return yield* new VisitTransitionInvalid({ currentStatus: visit.status, command: 'CHECKOUT' })
          }
          const existing = (yield* repository.listByVisit(visit.tenantId, visit.id)).find(
            (each) => each.status === 'ACTIVE',
          )
          if (existing !== undefined) return yield* new ReceiptAlreadyExists({ receiptId: existing.id })
        })

      /** 고른 진료의 받을 금액과 결산입니다. */
      const prepare = (visit: Visit, input: CheckoutOptions) =>
        Effect.gen(function* () {
          const all = (yield* encounters.listByPatient(visit.tenantId, visit.patientId)).filter(
            (each) => each.visitId === visit.id && each.status !== 'ENTERED_IN_ERROR',
          )
          const byId = new Map(all.map((each) => [each.id as string, each]))
          const ids = input.encounterIds === undefined ? all.map((each) => each.id) : [...new Set(input.encounterIds)]
          const invalid = ids.filter((id) => !byId.has(id))
          if (invalid.length > 0) return yield* new CheckoutEncounterInvalid({ encounterIds: invalid })

          const dues: EncounterDue[] = []
          const unsupported: Array<Id<'encounter'>> = []
          for (const id of ids) {
            const due = encounterDue(byId.get(id)!)
            if (due === null) unsupported.push(id)
            else dues.push(due)
          }
          if (unsupported.length > 0) return yield* new CheckoutCoverageUnsupported({ encounterIds: unsupported })

          // 미리 기록한 결제는 이 환자의 결제이고 아직 적용하지 않았으며, 내원을 정했다면 이 내원이어야 합니다
          const paymentIds = [...new Set(input.paymentIds ?? [])]
          const found = new Map(
            (yield* repository.listPayments(visit.tenantId, paymentIds)).map((each) => [each.id as string, each]),
          )
          const notApplicable = paymentIds.filter((id) => {
            const payment = found.get(id)
            return (
              payment === undefined ||
              payment.status !== 'UNAPPLIED' ||
              payment.patientId !== visit.patientId ||
              (payment.visitId !== null && payment.visitId !== visit.id)
            )
          })
          if (notApplicable.length > 0) return yield* new CheckoutPaymentInvalid({ paymentIds: notApplicable })
          const applied = paymentIds.map((id) => found.get(id)!).sort(byRecorded)

          const payments = input.payments ?? []
          const settlement = settleCheckout({
            encounters: dues,
            payments: [...applied.map((each) => ({ method: each.method, amount: each.amount })), ...payments],
            overpaidCreditBalance: 0,
            useOverpaidCredit: input.useOverpaidCredit ?? null,
            prepaidBalances: { CASH_LIKE: 0, CARD_LIKE: 0 },
            writeOffRemainder: input.writeOffRemainder ?? false,
            acknowledge: input.acknowledge ?? [],
          })
          const errors = settlement.errors.includes('PAYMENT_METHOD_NOT_ALLOWED')
            ? settlement.errors
            : normalizedPayments(payments).some((each) => EXTERNAL_METHODS.has(each.method))
              ? ['PAYMENT_METHOD_NOT_ALLOWED' as const, ...settlement.errors]
              : settlement.errors
          return {
            ids: ids as Array<Id<'encounter'>>,
            applied,
            dues,
            quoteId: quoteIdOf(dues),
            charges: chargesOf(dues),
            settlement,
            errors,
          }
        })

      const quote = Effect.fn('Receipts.quote')(function* (visitId: Id<'visit'>, input: CheckoutOptions) {
        const access = yield* CurrentAccess
        const visit = yield* findVisit(access.tenantId, visitId)
        yield* requireCheckoutable(visit)
        const prepared = yield* prepare(visit, input)
        const { settlement } = prepared
        return {
          quoteId: prepared.quoteId,
          encounters: prepared.dues.map((each) => ({
            encounterId: each.encounterId as Id<'encounter'>,
            due: each.due,
          })),
          charges: prepared.charges,
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
          errors: prepared.errors,
          warnings: settlement.warnings,
        }
      })

      const checkout = Effect.fn('Receipts.checkout')(function* (visitId: Id<'visit'>, input: CheckoutInput) {
        const access = yield* CurrentAccess
        const now = yield* DateTime.now
        const at = DateTime.formatIso(now)
        const { idempotencyKey, ...request } = input
        return yield* transaction.run(
          idempotent(
            {
              tenantId: access.tenantId,
              key: idempotencyKey,
              operation: 'visits.checkout',
              request: { visitId, ...request },
              now: at,
              schema: CheckedOut,
            },
            Effect.gen(function* () {
              const visit = yield* findVisit(access.tenantId, visitId)
              yield* requireCheckoutable(visit)
              const prepared = yield* prepare(visit, input)
              if (prepared.quoteId !== input.quoteId) return yield* new QuoteStale({ quoteId: prepared.quoteId })
              const { settlement } = prepared
              if (prepared.errors.length > 0 || settlement.warnings.length > 0) {
                return yield* new CheckoutRejected({ errors: prepared.errors, warnings: settlement.warnings })
              }

              // 수납 요청 안에서 받은 결제는 같은 시각이라 ID 순으로 읽힙니다. 요청 순서대로 커지는 ID를 줍니다
              const received = (input.payments ?? []).filter(
                (each) => each.amount.taxable + each.amount.taxExempt !== 0,
              )
              const freshIds = newIds('payment', received.length, DateTime.toEpochMillis(now))
              const receipt: Receipt = {
                id: newId('receipt'),
                tenantId: access.tenantId,
                visitId: visit.id,
                patientId: visit.patientId,
                date: clinicDate(DateTime.toEpochMillis(now)),
                cashierId: access.userId,
                memo: input.memo ?? '',
                encounterIds: prepared.ids,
                quoteId: prepared.quoteId,
                charges: prepared.charges,
                payments: [
                  ...prepared.applied,
                  ...received.map((each, index) => ({
                    id: freshIds[index]!,
                    method: each.method,
                    prepaidKind: each.prepaidKind ?? null,
                    amount: each.amount,
                    processorRef: null,
                    createdAt: at,
                  })),
                ]
                  .sort(byRecorded)
                  .map((each) => ({
                    id: each.id,
                    method: each.method,
                    prepaidKind: each.prepaidKind,
                    amount: each.amount,
                    processorRef: each.processorRef,
                    status: 'CAPTURED' as const,
                  })),
                settlement: {
                  due: settlement.due,
                  received: settlement.received,
                  result: settlement.result,
                  outstanding: settlement.outstanding,
                  overpaid: settlement.overpaid,
                  writtenOff: settlement.writtenOff,
                  acknowledged: settlement.acknowledged,
                },
                flags: { excludeFromTaxDeduction: input.excludeFromTaxDeduction ?? false },
                status: 'ACTIVE',
                createdAt: at,
                updatedAt: at,
                version: 1,
              }
              const event = domainEvent(
                'receipt.created',
                receipt.id,
                at,
                {
                  receiptId: receipt.id,
                  visitId: visit.id,
                  patientId: visit.patientId,
                  date: receipt.date,
                  total: receipt.charges.total,
                  result: settlement.result,
                  acknowledged: settlement.acknowledged,
                  paymentIds: receipt.payments.map((each) => each.id),
                },
                { tenantId: access.tenantId, actor: { kind: 'USER', id: access.userId } },
              )
              // 실패할 수 있는 내원 전이를 먼저 해, 되돌리지 못하는 메모리 저장소에서도 영수증만 남지 않습니다. 같은
              // 트랜잭션에서 방금 읽은 내원이라 전이는 늘 됩니다. 영수증 쓰기는 같은 트랜잭션에서 확인한 것(유효한
              // 영수증 없음, 적용할 결제가 UNAPPLIED)이 그대로일 때만 성공합니다. SQL은 트랜잭션이 하나씩 실행되어
              // 그대로이고, 메모리는 그 사이에 다른 요청이 끼어들면 내원만 COMPLETED로 남을 수 있습니다
              const completed = yield* visitCommands
                .apply(visit.id, 'CHECKOUT')
                .pipe(Effect.catchIf((error) => error._tag !== 'VisitTransitionInvalid', Effect.die))
              yield* repository.insert(
                receipt,
                [event],
                prepared.applied.map((each) => each.id),
              )
              return { receipt, visit: completed }
            }),
          ).pipe(Effect.provideService(IdempotencyStore, idempotency)),
        )
      })

      return Receipts.of({ quote, checkout })
    }),
  )
}
