import { Context, DateTime, Effect, Layer, Option } from 'effect'
import { Transaction } from '../../../shared/db/transaction.ts'
import { decisionContext } from '../../../shared/decision/decision-context.ts'
import { idempotent, IdempotencyKeyReused, IdempotencyStore } from '../../../shared/http/idempotency.ts'
import { newId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { ValidationFailed } from '../../../shared/problem/problem.ts'
import { daysBetween } from '../../../shared/time/calendar.ts'
import { clinicDayRange } from '../../../shared/time/clinic-date.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { ReceiptRepository } from '../receipts/receipt-repository.ts'
import {
  decideClose,
  decideOpen,
  decideRecordExpense,
  decideRemoveExpense,
  decideReopen,
} from './cash-drawer.aggregate.ts'
import type { CashDrawerWrite, ExpenseCommand, OpenCommand } from './cash-drawer.aggregate.ts'
import {
  type CashDrawer,
  type CashDrawerCarryOverUnavailable,
  type CashDrawerDateInFuture,
  type CashDrawerNotOpen,
  type CashDrawerRecord,
  type CashDrawerTransitionInvalid,
  Expense,
  ExpenseCategory,
  type ExpenseCategoryInvalid,
  ExpenseCategoryNameTaken,
  ExpenseCategoryNotFound,
  type ExpenseNotFound,
} from './cash-drawer-model.ts'
import { cashDrawerView } from './cash-drawer.view.ts'
import { CashDrawerRepository } from './cash-drawer-repository.ts'
import { cashLedger } from './cash-ledger.ts'

export type OpenInput = OpenCommand

export interface ExpenseInput extends ExpenseCommand {
  idempotencyKey: string
}

/** 지출 목록은 한 번에 이만큼의 날짜까지 받습니다. */
export const MAX_EXPENSE_RANGE_DAYS = 31

export type OpenError = CashDrawerTransitionInvalid | CashDrawerDateInFuture | CashDrawerCarryOverUnavailable
export type ExpenseError = CashDrawerNotOpen | ExpenseCategoryInvalid | IdempotencyKeyReused

/**
 * 시재와 지출입니다 (front-desk.md 시재와 지출). 시재는 병원·날짜마다 하나이고, 현금 흐름(현금 수납·환불·지출과 예상
 * 마감 금액)은 읽을 때마다 그날 결제·지출에서 계산합니다(`cashDrawerView`). 판정은 `cash-drawer.aggregate.ts`입니다.
 *
 * 마감 뒤 그날 현금 원장이 바뀌면 다시 마감할 때까지 `REOPENED`(`CHANGED_AFTER_CLOSE`)입니다. 바꾼 쪽(수납·환불·
 * 취소)이 시재를 고치지 않고, 마감할 때 남긴 원장 지문과 지금 원장을 비교해 판정합니다.
 */
export class CashDrawers extends Context.Service<
  CashDrawers,
  {
    /** 그날 시재입니다. 열지 않았어도 그날 현금 흐름을 담아 `NOT_OPENED`로 줍니다. */
    get(date: string): Effect.Effect<CashDrawer, never, CurrentAccess>
    /**
     * 시재를 엽니다. 오늘 이후 날짜는 422 `CASH_DRAWER_DATE_IN_FUTURE`, 이미 열었으면 409
     * `CASH_DRAWER_TRANSITION_INVALID`입니다. `carryOver`면 앞서 마감한 시재 중 가장 늦은 날의 센 금액을 시작 금액으로
     * 쓰고, 그런 시재가 없거나 그 시재가 지금 `CLOSED`가 아니면(다시 열림) 422 `CASH_DRAWER_CARRY_OVER_UNAVAILABLE`입니다. 시작 금액과 `carryOver`는 둘 중 하나만
     * 보냅니다(400).
     */
    open(date: string, input: OpenInput): Effect.Effect<CashDrawer, OpenError | ValidationFailed, CurrentAccess>
    /** 센 금액으로 마감합니다. `OPEN`·`REOPENED`일 때만 받고, 그때의 예상 마감 금액과의 차이를 남깁니다. */
    close(date: string, countedAmount: number): Effect.Effect<CashDrawer, CashDrawerTransitionInvalid, CurrentAccess>
    /** 마감한(`CLOSED`) 시재를 사유와 함께 다시 엽니다. */
    reopen(date: string, reason: string): Effect.Effect<CashDrawer, CashDrawerTransitionInvalid, CurrentAccess>

    /** `from`–`to`(둘 다 포함, 31일까지) 날짜의 지출입니다. */
    listExpenses(range: {
      from: string
      to: string
    }): Effect.Effect<ReadonlyArray<Expense>, ValidationFailed, CurrentAccess>
    /**
     * 지출을 기록합니다. 그날 시재가 `OPEN`·`REOPENED`가 아니면 409 `CASH_DRAWER_NOT_OPEN`, 항목이 없으면 422
     * `EXPENSE_CATEGORY_INVALID`입니다. `idempotencyKey`로 24시간 안에 같은 요청이 다시 오면 처음 응답을 돌려줍니다.
     */
    recordExpense(input: ExpenseInput): Effect.Effect<Expense, ExpenseError, CurrentAccess>
    /** 지출을 지웁니다. 기록은 `deleted`로 남깁니다. 그날 시재가 열려 있어야 합니다. */
    removeExpense(id: Id<'expense'>): Effect.Effect<void, ExpenseNotFound | CashDrawerNotOpen, CurrentAccess>

    listCategories(): Effect.Effect<ReadonlyArray<ExpenseCategory>, never, CurrentAccess>
    /** 같은 이름이 있으면 409 `EXPENSE_CATEGORY_NAME_TAKEN`입니다. */
    addCategory(name: string): Effect.Effect<ExpenseCategory, ExpenseCategoryNameTaken, CurrentAccess>
    removeCategory(id: Id<'expenseCategory'>): Effect.Effect<void, ExpenseCategoryNotFound, CurrentAccess>
  }
>()('hemr/front-desk/CashDrawers') {
  static readonly layer = Layer.effect(
    CashDrawers,
    Effect.gen(function* () {
      const repository = yield* CashDrawerRepository
      const receipts = yield* ReceiptRepository
      const transaction = yield* Transaction
      const idempotency = yield* IdempotencyStore

      /** 그날 현금 원장입니다. */
      const ledgerOf = (tenantId: Id<'tenant'>, date: string) =>
        Effect.gen(function* () {
          const payments = yield* receipts.paymentsTouched(tenantId, clinicDayRange(date))
          const expenses = yield* repository.listExpenses(tenantId, { from: date, to: date })
          return cashLedger(date, payments, expenses)
        })

      /** 저장한 시재와 지금 원장으로 계산한 그날 시재입니다. */
      const stateOf = (tenantId: Id<'tenant'>, date: string, record: CashDrawerRecord | null) =>
        ledgerOf(tenantId, date).pipe(Effect.map((ledger) => cashDrawerView(date, record, ledger)))

      const load = (tenantId: Id<'tenant'>, date: string) =>
        Effect.gen(function* () {
          return yield* stateOf(tenantId, date, Option.getOrNull(yield* repository.findDrawer(tenantId, date)))
        })

      /** 판정한 시재 쓰기를 저장하고, 새 시재로 응답을 다시 계산합니다. */
      const commitDrawer = (tenantId: Id<'tenant'>, date: string, decided: CashDrawerWrite) =>
        Effect.gen(function* () {
          yield* repository.commit(decided)
          return (yield* stateOf(tenantId, date, decided.drawer?.drawer ?? null)).drawer
        })

      const get = Effect.fn('CashDrawers.get')(function* (date: string) {
        const access = yield* CurrentAccess
        return (yield* load(access.tenantId, date)).drawer
      })

      const open = Effect.fn('CashDrawers.open')(function* (date: string, input: OpenInput) {
        const access = yield* CurrentAccess
        const context = decisionContext(access, yield* DateTime.now)
        return yield* transaction.run(
          Effect.gen(function* () {
            const state = yield* load(access.tenantId, date)
            // 이어받을 때만 앞 시재를 읽습니다
            const previous =
              input.carryOver === true
                ? Option.getOrNull(yield* repository.lastClosedBefore(access.tenantId, date))
                : null
            const previousState = previous === null ? null : yield* stateOf(access.tenantId, previous.date, previous)
            const decided = yield* Effect.fromResult(decideOpen(date, input, state, previousState, context))
            return yield* commitDrawer(access.tenantId, date, decided)
          }),
        )
      })

      const close = Effect.fn('CashDrawers.close')(function* (date: string, countedAmount: number) {
        const access = yield* CurrentAccess
        const context = decisionContext(access, yield* DateTime.now)
        return yield* transaction.run(
          Effect.gen(function* () {
            const decided = yield* Effect.fromResult(
              decideClose(yield* load(access.tenantId, date), countedAmount, context),
            )
            return yield* commitDrawer(access.tenantId, date, decided)
          }),
        )
      })

      const reopen = Effect.fn('CashDrawers.reopen')(function* (date: string, reason: string) {
        const access = yield* CurrentAccess
        const context = decisionContext(access, yield* DateTime.now)
        return yield* transaction.run(
          Effect.gen(function* () {
            const decided = yield* Effect.fromResult(decideReopen(yield* load(access.tenantId, date), reason, context))
            return yield* commitDrawer(access.tenantId, date, decided)
          }),
        )
      })

      const listExpenses = Effect.fn('CashDrawers.listExpenses')(function* (range: { from: string; to: string }) {
        const access = yield* CurrentAccess
        const days = daysBetween(range.from, range.to)
        if (days < 0 || days >= MAX_EXPENSE_RANGE_DAYS) {
          return yield* new ValidationFailed({ violations: [{ field: 'to', code: 'INVALID_VALUE' }] })
        }
        return yield* repository.listExpenses(access.tenantId, range)
      })

      const recordExpense = Effect.fn('CashDrawers.recordExpense')(function* (input: ExpenseInput) {
        const access = yield* CurrentAccess
        const context = decisionContext(access, yield* DateTime.now)
        const { idempotencyKey, ...request } = input
        return yield* transaction.run(
          idempotent(
            {
              tenantId: access.tenantId,
              key: idempotencyKey,
              operation: 'expenses.record',
              request,
              now: context.at,
              schema: Expense,
            },
            Effect.gen(function* () {
              const state = yield* load(access.tenantId, input.date)
              const category = Option.getOrNull(yield* repository.findCategory(access.tenantId, input.categoryId))
              const decided = yield* Effect.fromResult(
                decideRecordExpense(state, category, request, newId('expense'), context),
              )
              yield* repository.commit(decided)
              return decided.expense.expense
            }),
          ).pipe(Effect.provideService(IdempotencyStore, idempotency)),
        )
      })

      const removeExpense = Effect.fn('CashDrawers.removeExpense')(function* (id: Id<'expense'>) {
        const access = yield* CurrentAccess
        const context = decisionContext(access, yield* DateTime.now)
        return yield* transaction.run(
          Effect.gen(function* () {
            const expense = Option.getOrNull(yield* repository.findExpense(access.tenantId, id))
            const state = expense === null ? null : yield* load(access.tenantId, expense.date)
            yield* repository.commit(yield* Effect.fromResult(decideRemoveExpense(expense, state, context)))
          }),
        )
      })

      const listCategories = Effect.fn('CashDrawers.listCategories')(function* () {
        const access = yield* CurrentAccess
        return yield* repository.listCategories(access.tenantId)
      })

      const addCategory = Effect.fn('CashDrawers.addCategory')(function* (name: string) {
        const access = yield* CurrentAccess
        const category: ExpenseCategory = {
          id: newId('expenseCategory'),
          tenantId: access.tenantId,
          name,
          createdAt: DateTime.formatIso(yield* DateTime.now),
        }
        if (!(yield* repository.insertCategory(category))) return yield* new ExpenseCategoryNameTaken({})
        return category
      })

      const removeCategory = Effect.fn('CashDrawers.removeCategory')(function* (id: Id<'expenseCategory'>) {
        const access = yield* CurrentAccess
        if (!(yield* repository.removeCategory(access.tenantId, id))) return yield* new ExpenseCategoryNotFound({})
      })

      return CashDrawers.of({
        get,
        open,
        close,
        reopen,
        listExpenses,
        recordExpense,
        removeExpense,
        listCategories,
        addCategory,
        removeCategory,
      })
    }),
  )
}
