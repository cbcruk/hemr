import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'
import { TenantId, UserId } from '../../identity/identity.ts'
import { LocalDate } from '../../patients/patient.ts'
import { Won } from '../receipts/receipt.ts'

export const ExpenseId = Schema.String.pipe(Schema.refine((value): value is Id<'expense'> => isId('expense', value)))
export const ExpenseCategoryId = Schema.String.pipe(
  Schema.refine((value): value is Id<'expenseCategory'> => isId('expenseCategory', value)),
)

export const CashDrawerStatus = Schema.Literals(['NOT_OPENED', 'OPEN', 'CLOSED', 'REOPENED'])
export const CashDrawerCommand = Schema.Literals(['OPEN', 'CLOSE', 'REOPEN'])

/** 마감 기록입니다. 다시 마감하면 새 기록으로 바꿉니다. */
const Closing = Schema.Struct({
  countedAmount: Won,
  /** 마감할 때의 예상 마감 금액입니다. */
  expectedClosing: Schema.Int,
  /** `countedAmount − expectedClosing`입니다. */
  difference: Schema.Int,
  closedAt: Schema.String,
  closedBy: UserId,
})

/**
 * 저장하는 시재입니다. 병원·날짜마다 하나입니다. 현금 흐름은 저장하지 않고 읽을 때 결제·환불·지출에서 계산합니다.
 *
 * `closing.ledger`는 마감할 때 그날 현금 원장의 지문입니다. 읽을 때 지문이 다르면 마감 뒤 원장이 바뀐 것입니다.
 * `reopened`는 마지막 마감 뒤 `:reopen`한 기록이고, 다시 마감하면 비웁니다.
 */
export interface CashDrawerRecord {
  tenantId: Id<'tenant'>
  date: string
  openingAmount: number
  carriedOver: boolean
  openedAt: string
  openedBy: Id<'user'>
  closing: (typeof Closing.Type & { ledger: string }) | null
  reopened: { reason: string; at: string; by: Id<'user'> } | null
  version: number
}

/** 시재입니다 (front-desk.md 시재와 지출). 현금 흐름과 상태는 서버가 계산합니다. */
export const CashDrawer = Schema.Struct({
  date: LocalDate,
  status: CashDrawerStatus,
  /** 시작 금액입니다. 열지 않았으면 `null`입니다. */
  openingAmount: Schema.NullOr(Won),
  /** 시작 금액을 앞 시재의 마감 금액에서 이어받았는지입니다. */
  carriedOver: Schema.Boolean,
  /** 현금 수납의 합입니다. 선수금 현금 충전도 여기에 들어갑니다(충전 기능이 생기면). */
  cashIn: Schema.Int,
  cashRefunds: Schema.Int,
  expenses: Schema.Int,
  /** `시작 + 현금 수납 − 지출 − 현금 환불`입니다. 열지 않았으면 `null`입니다. */
  expectedClosing: Schema.NullOr(Schema.Int),
  opened: Schema.NullOr(Schema.Struct({ at: Schema.String, by: UserId })),
  closing: Schema.NullOr(Closing),
  /**
   * 마지막 마감 뒤 다시 열린 이유입니다. `MANUAL`은 `:reopen`이고, `CHANGED_AFTER_CLOSE`는 마감 뒤 그날 현금
   * 원장이 바뀐 것입니다(이때 `reason`·`at`·`by`는 `null`). 둘 다면 `MANUAL`입니다.
   */
  reopened: Schema.NullOr(
    Schema.Struct({
      cause: Schema.Literals(['MANUAL', 'CHANGED_AFTER_CLOSE']),
      reason: Schema.NullOr(Schema.String),
      at: Schema.NullOr(Schema.String),
      by: Schema.NullOr(UserId),
    }),
  ),
  /** 저장한 버전입니다. 열지 않았으면 0입니다. */
  version: Schema.Int,
})
export type CashDrawer = typeof CashDrawer.Type

/** 지출 항목입니다(현행 출금 사유). */
export const ExpenseCategory = Schema.Struct({
  id: ExpenseCategoryId,
  tenantId: TenantId,
  name: Schema.String,
  createdAt: Schema.String,
})
export type ExpenseCategory = typeof ExpenseCategory.Type

/** 지출입니다. 시재에서 나간 현금입니다. 지우면 기록을 남기고(`deleted`) 목록과 시재에서 뺍니다. */
export const Expense = Schema.Struct({
  id: ExpenseId,
  tenantId: TenantId,
  /** 현금이 나간 날입니다. 그날 시재에 들어갑니다. */
  date: LocalDate,
  amount: Won,
  /** 기록할 때의 지출 항목입니다. 항목을 지워도 남습니다. */
  category: Schema.Struct({ id: ExpenseCategoryId, name: Schema.String }),
  memo: Schema.String,
  recordedBy: UserId,
  createdAt: Schema.String,
  deleted: Schema.NullOr(Schema.Struct({ at: Schema.String, by: UserId })),
  version: Schema.Int,
})
export type Expense = typeof Expense.Type

/** 시재의 지금 상태에서는 이 커맨드를 보낼 수 없습니다. */
export class CashDrawerTransitionInvalid extends HttpApiError.Problem<CashDrawerTransitionInvalid>()(
  'CashDrawerTransitionInvalid',
  {
    type: problemType('CASH_DRAWER_TRANSITION_INVALID'),
    status: 409,
    title: 'Cash drawer status does not allow this command',
  },
  { code: Schema.tag('CASH_DRAWER_TRANSITION_INVALID'), currentStatus: CashDrawerStatus, command: CashDrawerCommand },
) {}

/** 지출은 그날 시재가 열려 있을 때(`OPEN`·`REOPENED`)만 기록하거나 지웁니다. */
export class CashDrawerNotOpen extends HttpApiError.Problem<CashDrawerNotOpen>()(
  'CashDrawerNotOpen',
  { type: problemType('CASH_DRAWER_NOT_OPEN'), status: 409, title: 'Cash drawer of the date is not open' },
  { code: Schema.tag('CASH_DRAWER_NOT_OPEN'), date: LocalDate, currentStatus: CashDrawerStatus },
) {}

/** 아직 오지 않은 날의 시재는 열 수 없습니다. */
export class CashDrawerDateInFuture extends HttpApiError.Problem<CashDrawerDateInFuture>()(
  'CashDrawerDateInFuture',
  { type: problemType('CASH_DRAWER_DATE_IN_FUTURE'), status: 422, title: 'Cash drawer date is in the future' },
  { code: Schema.tag('CASH_DRAWER_DATE_IN_FUTURE') },
) {}

/** 이어받을 앞 시재의 마감 금액이 없습니다. */
export class CashDrawerCarryOverUnavailable extends HttpApiError.Problem<CashDrawerCarryOverUnavailable>()(
  'CashDrawerCarryOverUnavailable',
  {
    type: problemType('CASH_DRAWER_CARRY_OVER_UNAVAILABLE'),
    status: 422,
    title: 'No earlier closed cash drawer to carry over',
  },
  { code: Schema.tag('CASH_DRAWER_CARRY_OVER_UNAVAILABLE') },
) {}

export class ExpenseNotFound extends HttpApiError.Problem<ExpenseNotFound>()(
  'ExpenseNotFound',
  { type: problemType('EXPENSE_NOT_FOUND'), status: 404, title: 'Expense not found' },
  { code: Schema.tag('EXPENSE_NOT_FOUND') },
) {}

/** 지출에 고른 항목이 없습니다. */
export class ExpenseCategoryInvalid extends HttpApiError.Problem<ExpenseCategoryInvalid>()(
  'ExpenseCategoryInvalid',
  { type: problemType('EXPENSE_CATEGORY_INVALID'), status: 422, title: 'Expense category does not exist' },
  { code: Schema.tag('EXPENSE_CATEGORY_INVALID') },
) {}

export class ExpenseCategoryNotFound extends HttpApiError.Problem<ExpenseCategoryNotFound>()(
  'ExpenseCategoryNotFound',
  { type: problemType('EXPENSE_CATEGORY_NOT_FOUND'), status: 404, title: 'Expense category not found' },
  { code: Schema.tag('EXPENSE_CATEGORY_NOT_FOUND') },
) {}

export class ExpenseCategoryNameTaken extends HttpApiError.Problem<ExpenseCategoryNameTaken>()(
  'ExpenseCategoryNameTaken',
  { type: problemType('EXPENSE_CATEGORY_NAME_TAKEN'), status: 409, title: 'Expense category name is already taken' },
  { code: Schema.tag('EXPENSE_CATEGORY_NAME_TAKEN') },
) {}
