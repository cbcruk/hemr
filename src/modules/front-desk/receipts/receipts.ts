import { Context, DateTime, Effect, Layer, Option, Schema } from 'effect'
import { Transaction } from '../../../shared/db/transaction.ts'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import { idempotent, IdempotencyKeyReused, IdempotencyStore } from '../../../shared/http/idempotency.ts'
import { isId, newId, newIds } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { ValidationFailed } from '../../../shared/problem/problem.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { EncounterRepository } from '../../clinical/encounters/encounter-repository.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { VisitRepository } from '../visits/visit-repository.ts'
import { Visit, VisitNotFound, VisitTransitionInvalid } from '../visits/visit.ts'
import { Visits } from '../visits/visits.ts'
import { normalizedPayments, settleCheckout } from './checkout-settlement.ts'
import type { CheckoutPayment, EncounterDue, OverpaidCreditTarget, PaymentMethod } from './checkout-settlement.types.ts'
import { refundableOf, toReceiptPayment, voidReceipt } from './receipt-adjustments.ts'
import { chargesOf, encounterDue, quoteIdOf } from './receipt-charges.ts'
import { ReceiptRepository } from './receipt-repository.ts'
import {
  byRecorded,
  CheckoutCoverageUnsupported,
  CheckoutEncounterInvalid,
  CheckoutPaymentInvalid,
  CheckoutRejected,
  ExternalPaymentMethod,
  type Payment,
  PaymentRefundRequired,
  QuoteStale,
  Receipt,
  ReceiptAlreadyExists,
  type ReceiptCharges,
  ReceiptNotFound,
  type ReceiptRecord,
  ReceiptVoided,
  recordOf,
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

/** 정정 입력입니다. 진료는 앞 영수증의 진료 그대로이고, 결제와 결산 선택을 다시 받습니다. */
export interface CorrectInput extends Omit<CheckoutOptions, 'encounterIds'> {
  reason: string
  excludeFromTaxDeduction?: boolean
  memo?: string
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
export type VoidError = ReceiptNotFound | ReceiptVoided | PaymentRefundRequired
export type CorrectError =
  | ReceiptNotFound
  | ReceiptVoided
  | CheckoutEncounterInvalid
  | CheckoutCoverageUnsupported
  | CheckoutPaymentInvalid
  | CheckoutRejected
  | IdempotencyKeyReused

/** 밖에서 승인되는 결제 수단입니다. 수납 요청의 `payments`로 보내면 `PAYMENT_METHOD_NOT_ALLOWED`입니다. */
const EXTERNAL_METHODS: ReadonlySet<PaymentMethod> = new Set(ExternalPaymentMethod.literals)

/**
 * 수납입니다 (front-desk.md 수납 커맨드, 환불과 정정). 견적(`quote`)·수납(`checkout`)·정정(`correct`)이 같은
 * 계산(`settleCheckout`)을 씁니다.
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

      const findReceipt = (tenantId: Id<'tenant'>, id: Id<'receipt'>) =>
        repository
          .findById(tenantId, id)
          .pipe(
            Effect.flatMap(
              Option.match({ onNone: () => Effect.fail(new ReceiptNotFound({})), onSome: Effect.succeed }),
            ),
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

      /** 이 내원의 진료 중 고른 것의 받을 금액입니다. 고르지 않으면 철회하지 않은 진료 전부입니다. */
      const duesOf = (visit: Visit, encounterIds: ReadonlyArray<Id<'encounter'>> | undefined) =>
        Effect.gen(function* () {
          const all = (yield* encounters.listByPatient(visit.tenantId, visit.patientId)).filter(
            (each) => each.visitId === visit.id && each.status !== 'ENTERED_IN_ERROR',
          )
          const byId = new Map(all.map((each) => [each.id as string, each]))
          const ids = encounterIds === undefined ? all.map((each) => each.id) : [...new Set(encounterIds)]
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
          return { ids: ids as Array<Id<'encounter'>>, dues }
        })

      /** 미리 기록한 결제는 이 환자의 결제이고 아직 적용하지 않았으며, 내원을 정했다면 이 내원이어야 합니다. */
      const applicable = (visit: Visit, paymentIds: ReadonlyArray<Id<'payment'>> | undefined) =>
        Effect.gen(function* () {
          const ids = [...new Set(paymentIds ?? [])]
          const found = new Map(
            (yield* repository.listPayments(visit.tenantId, ids)).map((each) => [each.id as string, each]),
          )
          const notApplicable = ids.filter((id) => {
            const payment = found.get(id)
            return (
              payment === undefined ||
              payment.status !== 'UNAPPLIED' ||
              payment.patientId !== visit.patientId ||
              (payment.visitId !== null && payment.visitId !== visit.id)
            )
          })
          if (notApplicable.length > 0) return yield* new CheckoutPaymentInvalid({ paymentIds: notApplicable })
          return ids.map((id) => found.get(id)!)
        })

      /**
       * 결산입니다. 이미 받은 결제(`held`, 미리 기록했거나 정정으로 옮긴 결제)는 환불하고 남은 금액으로, 요청의
       * 결제(`payments`)와 함께 넣습니다.
       */
      const settle = (
        dues: ReadonlyArray<EncounterDue>,
        held: ReadonlyArray<Payment>,
        input: Omit<CheckoutOptions, 'encounterIds' | 'paymentIds'>,
      ) => {
        const payments = input.payments ?? []
        const settlement = settleCheckout({
          encounters: dues,
          payments: [...held.map((each) => ({ method: each.method, amount: refundableOf(each) })), ...payments],
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
        return { settlement, errors }
      }

      /** 고른 진료의 받을 금액과 결산입니다. */
      const prepare = (visit: Visit, input: CheckoutOptions) =>
        Effect.gen(function* () {
          const { ids, dues } = yield* duesOf(visit, input.encounterIds)
          const applied = (yield* applicable(visit, input.paymentIds)).sort(byRecorded)
          const { settlement, errors } = settle(dues, applied, input)
          return {
            ids,
            applied,
            dues,
            quoteId: quoteIdOf(dues),
            charges: chargesOf(dues),
            settlement,
            errors,
          }
        })

      /**
       * 새 영수증과 그 결제입니다. 이미 받은 결제(`held`)는 이 영수증으로 옮기고(미리 기록한 결제는 `CAPTURED`로),
       * 요청의 0원 아닌 결제는 새로 만듭니다. 요청의 결제는 같은 시각이라 ID 순으로 읽히므로 요청 순서대로 커지는 ID를
       * 줍니다.
       */
      const buildReceipt = (input: {
        access: CurrentAccess['Service']
        now: DateTime.Utc
        visit: Visit
        ids: ReadonlyArray<Id<'encounter'>>
        dues: ReadonlyArray<EncounterDue>
        held: ReadonlyArray<Payment>
        payments: ReadonlyArray<CheckoutPayment>
        settlement: ReturnType<typeof settle>['settlement']
        options: { excludeFromTaxDeduction?: boolean; memo?: string }
        correctionOf: Id<'receipt'> | null
        id?: Id<'receipt'>
      }) => {
        const at = DateTime.formatIso(input.now)
        const millis = DateTime.toEpochMillis(input.now)
        const id = input.id ?? newId('receipt', millis)
        const received = input.payments.filter((each) => each.amount.taxable + each.amount.taxExempt !== 0)
        const freshIds = newIds('payment', received.length, millis)
        const held = input.held.map((each): Payment => ({
          ...each,
          receiptId: id,
          visitId: each.visitId ?? input.visit.id,
          status: each.status === 'UNAPPLIED' ? 'CAPTURED' : each.status,
          updatedAt: at,
          version: each.version + 1,
        }))
        const fresh = received.map((each, index): Payment => ({
          id: freshIds[index]!,
          tenantId: input.access.tenantId,
          patientId: input.visit.patientId,
          visitId: input.visit.id,
          receiptId: id,
          method: each.method,
          prepaidKind: each.prepaidKind ?? null,
          amount: each.amount,
          processorRef: null,
          status: 'CAPTURED',
          refunds: [],
          recordedBy: input.access.userId,
          createdAt: at,
          updatedAt: at,
          version: 1,
        }))
        const { settlement } = input
        const record: ReceiptRecord = {
          id,
          tenantId: input.access.tenantId,
          visitId: input.visit.id,
          patientId: input.visit.patientId,
          date: clinicDate(millis),
          cashierId: input.access.userId,
          memo: input.options.memo ?? '',
          encounterIds: input.ids,
          quoteId: quoteIdOf(input.dues),
          charges: chargesOf(input.dues),
          settlement: {
            due: settlement.due,
            received: settlement.received,
            result: settlement.result,
            outstanding: settlement.outstanding,
            overpaid: settlement.overpaid,
            writtenOff: settlement.writtenOff,
            acknowledged: settlement.acknowledged,
          },
          flags: { excludeFromTaxDeduction: input.options.excludeFromTaxDeduction ?? false },
          status: 'ACTIVE',
          voided: null,
          correctionOf: input.correctionOf,
          createdAt: at,
          updatedAt: at,
          version: 1,
        }
        const receipt: Receipt = { ...record, payments: [...held, ...fresh].sort(byRecorded).map(toReceiptPayment) }
        const event = domainEvent(
          'receipt.created',
          id,
          at,
          {
            receiptId: id,
            visitId: input.visit.id,
            patientId: input.visit.patientId,
            date: record.date,
            total: record.charges.total,
            result: settlement.result,
            acknowledged: settlement.acknowledged,
            paymentIds: receipt.payments.map((each) => each.id),
            correctionOf: input.correctionOf,
          },
          { tenantId: input.access.tenantId, actor: { kind: 'USER', id: input.access.userId } },
        )
        return {
          receipt,
          event,
          changes: {
            insertReceipts: [record],
            updatePayments: input.held.map((each, index) => ({ payment: held[index]!, expectedVersion: each.version })),
            insertPayments: fresh,
          },
        }
      }

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
            Effect.gen(function* () {
              const visit = yield* findVisit(access.tenantId, visitId)
              yield* requireCheckoutable(visit)
              const prepared = yield* prepare(visit, input)
              if (prepared.quoteId !== input.quoteId) return yield* new QuoteStale({ quoteId: prepared.quoteId })
              const { settlement } = prepared
              if (prepared.errors.length > 0 || settlement.warnings.length > 0) {
                return yield* new CheckoutRejected({ errors: prepared.errors, warnings: settlement.warnings })
              }
              const built = buildReceipt({
                access,
                now,
                visit,
                ids: prepared.ids,
                dues: prepared.dues,
                held: prepared.applied,
                payments: input.payments ?? [],
                settlement,
                options: input,
                correctionOf: null,
              })
              // 실패할 수 있는 내원 전이를 먼저 해, 되돌리지 못하는 메모리 저장소에서도 영수증만 남지 않습니다. 같은
              // 트랜잭션에서 방금 읽은 내원이라 전이는 늘 됩니다. 영수증 쓰기는 같은 트랜잭션에서 확인한 것(유효한
              // 영수증 없음, 적용할 결제가 UNAPPLIED)이 그대로일 때만 성공합니다. SQL은 트랜잭션이 하나씩 실행되어
              // 그대로이고, 메모리는 그 사이에 다른 요청이 끼어들면 내원만 COMPLETED로 남을 수 있습니다
              const completed = yield* visitCommands
                .apply(visit.id, 'CHECKOUT')
                .pipe(Effect.catchIf((error) => error._tag !== 'VisitTransitionInvalid', Effect.die))
              yield* repository.commit({ ...built.changes, events: [built.event] })
              return { receipt: built.receipt, visit: completed }
            }),
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
        const at = DateTime.formatIso(yield* DateTime.now)
        return yield* transaction.run(
          Effect.gen(function* () {
            const receipt = yield* findReceipt(access.tenantId, id)
            if (receipt.status === 'VOIDED') return yield* new ReceiptVoided({})
            const payments = yield* repository.paymentsOf(access.tenantId, id)
            const decision = voidReceipt(recordOf(receipt), payments, { reason, at, by: access.userId })
            if (!decision.ok) {
              return yield* new PaymentRefundRequired({ receiptId: id, paymentIds: decision.paymentIds })
            }
            const event = domainEvent(
              'receipt.voided',
              id,
              at,
              {
                receiptId: id,
                visitId: receipt.visitId,
                patientId: receipt.patientId,
                date: receipt.date,
                reason,
                correctedBy: null,
              },
              { tenantId: access.tenantId, actor: { kind: 'USER', id: access.userId } },
            )
            yield* repository.commit({
              updateReceipts: [{ receipt: decision.receipt, expectedVersion: receipt.version }],
              updatePayments: decision.voided.map((each) => ({ payment: each, expectedVersion: each.version - 1 })),
              events: [event],
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
        const at = DateTime.formatIso(now)
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
              if (receipt.status === 'VOIDED') return yield* new ReceiptVoided({})
              // 내원은 지우지 않으므로 영수증의 내원은 늘 있습니다
              const visit = yield* findVisit(access.tenantId, receipt.visitId).pipe(Effect.orDie)
              const { ids, dues } = yield* duesOf(visit, receipt.encounterIds)
              const applied = yield* applicable(visit, input.paymentIds)
              const newReceiptId = newId('receipt', DateTime.toEpochMillis(now))
              const decision = voidReceipt(recordOf(receipt), yield* repository.paymentsOf(access.tenantId, id), {
                reason: input.reason,
                at,
                by: access.userId,
                correctedBy: newReceiptId,
              })
              // 정정은 밖에서 취소할 결제를 옮기므로 막히지 않습니다
              if (!decision.ok) return yield* Effect.die(new Error('correction cannot be blocked by refunds'))
              const held = [...decision.carried, ...applied].sort(byRecorded)
              const { settlement, errors } = settle(dues, held, input)
              if (errors.length > 0 || settlement.warnings.length > 0) {
                return yield* new CheckoutRejected({ errors, warnings: settlement.warnings })
              }
              const built = buildReceipt({
                access,
                now,
                visit,
                ids,
                dues,
                held,
                payments: input.payments ?? [],
                settlement,
                // 고치지 않은 메모·소득공제 제외는 앞 영수증 것을 이어받습니다. 결제만 바꾸는 정정이 연말정산 표시를 되돌리지 않게 합니다
                options: {
                  memo: input.memo ?? receipt.memo,
                  excludeFromTaxDeduction: input.excludeFromTaxDeduction ?? receipt.flags.excludeFromTaxDeduction,
                },
                correctionOf: id,
                id: newReceiptId,
              })
              const voidedEvent = domainEvent(
                'receipt.voided',
                id,
                at,
                {
                  receiptId: id,
                  visitId: receipt.visitId,
                  patientId: receipt.patientId,
                  date: receipt.date,
                  reason: input.reason,
                  correctedBy: newReceiptId,
                },
                { tenantId: access.tenantId, actor: { kind: 'USER', id: access.userId } },
              )
              yield* repository.commit({
                updateReceipts: [{ receipt: decision.receipt, expectedVersion: receipt.version }],
                insertReceipts: built.changes.insertReceipts,
                updatePayments: [
                  ...decision.voided.map((each) => ({ payment: each, expectedVersion: each.version - 1 })),
                  ...built.changes.updatePayments,
                ],
                insertPayments: built.changes.insertPayments,
                events: [voidedEvent, built.event],
              })
              return built.receipt
            }),
          ).pipe(Effect.provideService(IdempotencyStore, idempotency)),
        )
      })

      return Receipts.of({ quote, checkout, get, list, void: voidOne, correct })
    }),
  )
}
