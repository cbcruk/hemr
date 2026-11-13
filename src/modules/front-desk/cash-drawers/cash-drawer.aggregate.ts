import { Result } from 'effect'
import { domainEvent, eventContext } from '../../../shared/events/domain-event.ts'
import type { DecisionContext, DomainEvent } from '../../../shared/events/domain-event.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { ValidationFailed } from '../../../shared/problem/problem.ts'
import { closingDifference } from './cash-drawer.ts'
import {
  CashDrawerCarryOverUnavailable,
  CashDrawerDateInFuture,
  CashDrawerNotOpen,
  CashDrawerTransitionInvalid,
  ExpenseCategoryInvalid,
  ExpenseNotFound,
} from './cash-drawer-model.ts'
import type { CashDrawerRecord, Expense, ExpenseCategory } from './cash-drawer-model.ts'
import type { CashDrawerState } from './cash-drawer.view.ts'
import { ledgerFingerprint } from './cash-ledger.ts'

/**
 * 시재 애그리거트입니다 (docs/design/domain-model.md, front-desk.md 시재와 지출). 시재는 병원·날짜마다 하나이고, 열기·
 * 마감·다시 열기와 그날 지출 기록·삭제를 판정합니다. 상태는 저장하지 않고 원장에서 계산하므로(`cash-drawer.view.ts`)
 * 판정은 서비스가 계산해 둔 그날 시재(`CashDrawerState`)를 받습니다. 모든 변경은 `cash_drawer.changed`를 냅니다.
 */

/** 시재·지출 쓰기입니다. 한 트랜잭션에 씁니다. */
export interface CashDrawerWrite {
  drawer?: { drawer: CashDrawerRecord; expectedVersion: number | null }
  expense?: { expense: Expense; expectedVersion: number | null }
  events: ReadonlyArray<DomainEvent>
}

const changed = (date: string, context: DecisionContext) =>
  domainEvent('cash_drawer.changed', date, context.at, { date }, eventContext(context))

/** 열기 입력입니다. 시작 금액과 `carryOver`는 둘 중 하나만 보냅니다. */
export interface OpenCommand {
  /** 시작 금액입니다. `carryOver`와 함께 보내지 않습니다. */
  openingAmount?: number
  /** 앞 시재의 마감 금액을 시작 금액으로 이어받습니다. */
  carryOver?: boolean
}

/**
 * 시재 열기를 판정합니다. 시작 금액과 `carryOver`를 둘 다 보내거나 둘 다 빠뜨리면 400, 오늘 이후 날짜는 422
 * `CASH_DRAWER_DATE_IN_FUTURE`, 이미 열었으면 409 `CASH_DRAWER_TRANSITION_INVALID`입니다.
 *
 * `carryOver`면 `previous`(앞서 마감한 시재 중 가장 늦은 날)의 센 금액을 시작 금액으로 씁니다. 그런 시재가 없거나 지금
 * `CLOSED`가 아니면(다시 열렸거나 마감 뒤 원장이 바뀜) 그 금액이 지금 돈통과 맞지 않아 422
 * `CASH_DRAWER_CARRY_OVER_UNAVAILABLE`입니다.
 */
export function decideOpen(
  date: string,
  input: OpenCommand,
  state: CashDrawerState,
  previous: CashDrawerState | null,
  context: DecisionContext,
): Result.Result<
  CashDrawerWrite,
  ValidationFailed | CashDrawerDateInFuture | CashDrawerTransitionInvalid | CashDrawerCarryOverUnavailable
> {
  const carryOver = input.carryOver === true
  if (carryOver === (input.openingAmount !== undefined)) {
    return Result.fail(
      new ValidationFailed({
        violations: [{ field: carryOver ? 'carryOver' : 'openingAmount', code: 'INVALID_VALUE' }],
      }),
    )
  }
  if (date > context.today) return Result.fail(new CashDrawerDateInFuture({}))
  if (state.record !== null) {
    return Result.fail(new CashDrawerTransitionInvalid({ currentStatus: state.drawer.status, command: 'OPEN' }))
  }
  let openingAmount = input.openingAmount ?? 0
  if (carryOver) {
    const closing = previous?.record?.closing
    if (closing == null || previous?.drawer.status !== 'CLOSED') {
      return Result.fail(new CashDrawerCarryOverUnavailable({}))
    }
    openingAmount = closing.countedAmount
  }
  const opened: CashDrawerRecord = {
    tenantId: context.tenantId,
    date,
    openingAmount,
    carriedOver: carryOver,
    openedAt: context.at,
    openedBy: context.userId,
    closing: null,
    reopened: null,
    version: 1,
  }
  return Result.succeed({ drawer: { drawer: opened, expectedVersion: null }, events: [changed(date, context)] })
}

/**
 * 마감을 판정합니다. `OPEN`·`REOPENED`일 때만 받고(그 밖은 409), 그때의 예상 마감 금액과 센 금액의 차이와 원장
 * 지문을 남깁니다. 지문은 마감 뒤 원장이 바뀌었는지 알아보는 데 씁니다.
 */
export function decideClose(
  state: CashDrawerState,
  countedAmount: number,
  context: DecisionContext,
): Result.Result<CashDrawerWrite, CashDrawerTransitionInvalid> {
  const { record, drawer, flow } = state
  if (record === null || (drawer.status !== 'OPEN' && drawer.status !== 'REOPENED')) {
    return Result.fail(new CashDrawerTransitionInvalid({ currentStatus: drawer.status, command: 'CLOSE' }))
  }
  const closed: CashDrawerRecord = {
    ...record,
    closing: {
      countedAmount,
      expectedClosing: flow.expectedClosing,
      difference: closingDifference(countedAmount, flow.expectedClosing),
      closedAt: context.at,
      closedBy: context.userId,
      ledger: ledgerFingerprint(state.ledger),
    },
    reopened: null,
    version: record.version + 1,
  }
  return Result.succeed({
    drawer: { drawer: closed, expectedVersion: record.version },
    events: [changed(drawer.date, context)],
  })
}

/** 다시 열기를 판정합니다. 마감한(`CLOSED`) 시재만 사유와 함께 다시 열고, 그 밖은 409입니다. */
export function decideReopen(
  state: CashDrawerState,
  reason: string,
  context: DecisionContext,
): Result.Result<CashDrawerWrite, CashDrawerTransitionInvalid> {
  const { record, drawer } = state
  if (record === null || drawer.status !== 'CLOSED') {
    return Result.fail(new CashDrawerTransitionInvalid({ currentStatus: drawer.status, command: 'REOPEN' }))
  }
  const reopened: CashDrawerRecord = {
    ...record,
    reopened: { reason, at: context.at, by: context.userId },
    version: record.version + 1,
  }
  return Result.succeed({
    drawer: { drawer: reopened, expectedVersion: record.version },
    events: [changed(drawer.date, context)],
  })
}

/** 지출을 바꿀 수 있게 그날 시재가 열려 있는지입니다. `OPEN`·`REOPENED`가 아니면 409 `CASH_DRAWER_NOT_OPEN`입니다. */
function open(state: CashDrawerState): Result.Result<void, CashDrawerNotOpen> {
  const { drawer } = state
  return drawer.status === 'OPEN' || drawer.status === 'REOPENED'
    ? Result.void
    : Result.fail(new CashDrawerNotOpen({ date: drawer.date, currentStatus: drawer.status }))
}

/** 지출 입력입니다. */
export interface ExpenseCommand {
  date: string
  amount: number
  categoryId: Id<'expenseCategory'>
  memo?: string
}

/**
 * 지출 기록을 판정합니다. 그날 시재가 열려 있지 않으면 409 `CASH_DRAWER_NOT_OPEN`, 항목이 없으면(`category`가 `null`)
 * 422 `EXPENSE_CATEGORY_INVALID`입니다. 항목 이름은 지출에 따로 남겨, 항목을 지워도 기록은 그대로입니다.
 */
export function decideRecordExpense(
  state: CashDrawerState,
  category: ExpenseCategory | null,
  input: ExpenseCommand,
  expenseId: Id<'expense'>,
  context: DecisionContext,
): Result.Result<CashDrawerWrite & { expense: { expense: Expense } }, CashDrawerNotOpen | ExpenseCategoryInvalid> {
  const opened = open(state)
  if (Result.isFailure(opened)) return Result.fail(opened.failure)
  if (category === null) return Result.fail(new ExpenseCategoryInvalid({}))
  const expense: Expense = {
    id: expenseId,
    tenantId: context.tenantId,
    date: input.date,
    amount: input.amount,
    category: { id: category.id, name: category.name },
    memo: input.memo ?? '',
    recordedBy: context.userId,
    createdAt: context.at,
    deleted: null,
    version: 1,
  }
  return Result.succeed({ expense: { expense, expectedVersion: null }, events: [changed(input.date, context)] })
}

/**
 * 지출 삭제를 판정합니다. 없거나 이미 지운 지출은 404 `EXPENSE_NOT_FOUND`, 그날 시재가 열려 있지 않으면 409입니다.
 * 기록은 `deleted`로 남깁니다. `state`는 지출 날짜의 시재이고, 지출이 없으면 `null`입니다.
 */
export function decideRemoveExpense(
  expense: Expense | null,
  state: CashDrawerState | null,
  context: DecisionContext,
): Result.Result<CashDrawerWrite, ExpenseNotFound | CashDrawerNotOpen> {
  if (expense === null || expense.deleted !== null) return Result.fail(new ExpenseNotFound({}))
  if (state === null) throw new Error(`cash drawer of expense ${expense.id} was not read`)
  const opened = open(state)
  if (Result.isFailure(opened)) return Result.fail(opened.failure)
  return Result.succeed({
    expense: {
      expense: { ...expense, deleted: { at: context.at, by: context.userId }, version: expense.version + 1 },
      expectedVersion: expense.version,
    },
    events: [changed(expense.date, context)],
  })
}
