import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api'
import { IdempotencyKey, IdempotencyKeyReused } from '../../../shared/http/idempotency.ts'
import { ValidationFailed } from '../../../shared/problem/problem.ts'
import { Access } from '../../identity/auth/access.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import { LocalDate } from '../../patients/patient.ts'
import { Won } from '../receipts/receipt.ts'
import {
  CashDrawer,
  CashDrawerCarryOverUnavailable,
  CashDrawerDateInFuture,
  CashDrawerNotOpen,
  CashDrawerTransitionInvalid,
  Expense,
  ExpenseCategory,
  ExpenseCategoryId,
  ExpenseCategoryInvalid,
  ExpenseCategoryNameTaken,
  ExpenseCategoryNotFound,
  ExpenseId,
  ExpenseNotFound,
} from './cash-drawer-model.ts'

const strict = { errors: 'all', onExcessProperty: 'error' } as const
const dateParams = { date: LocalDate }
/** 공백만 있는 글은 받지 않습니다. */
const Text = (max: number) => Schema.String.check(Schema.isMaxLength(max), Schema.isPattern(/\S/))

/**
 * 시재와 지출입니다 (front-desk.md 시재와 지출). 조회는 `cash_drawer:read`, 시재 커맨드와 지출 쓰기는
 * `cash_drawer:update`, 지출 항목 설정은 `setting.normal:update`가 필요합니다.
 */
export class CashDrawersApi extends HttpApiGroup.make('cashDrawers')
  .add(
    HttpApiEndpoint.get('get', '/cash-drawers/:date', {
      params: dateParams,
      success: CashDrawer,
    }).annotate(Access, Access.requires('cash_drawer:read')),
    HttpApiEndpoint.post('open', '/cash-drawers/:date::open', {
      params: dateParams,
      payload: Schema.Struct({
        openingAmount: Schema.optionalKey(Won),
        carryOver: Schema.optionalKey(Schema.Boolean),
      }),
      success: CashDrawer,
      error: [CashDrawerTransitionInvalid, CashDrawerDateInFuture, CashDrawerCarryOverUnavailable, ValidationFailed],
    })
      .annotate(Access, Access.requires('cash_drawer:update'))
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.post('close', '/cash-drawers/:date::close', {
      params: dateParams,
      payload: Schema.Struct({ countedAmount: Won }),
      success: CashDrawer,
      error: CashDrawerTransitionInvalid,
    })
      .annotate(Access, Access.requires('cash_drawer:update'))
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.post('reopen', '/cash-drawers/:date::reopen', {
      params: dateParams,
      payload: Schema.Struct({ reason: Text(500) }),
      success: CashDrawer,
      error: CashDrawerTransitionInvalid,
    })
      .annotate(Access, Access.requires('cash_drawer:update'))
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.get('listExpenses', '/expenses', {
      query: { from: LocalDate, to: LocalDate },
      success: Schema.Struct({ items: Schema.Array(Expense) }),
      error: ValidationFailed,
    }).annotate(Access, Access.requires('cash_drawer:read')),
    HttpApiEndpoint.post('recordExpense', '/expenses', {
      headers: { 'idempotency-key': IdempotencyKey },
      payload: Schema.Struct({
        date: LocalDate,
        amount: Won.check(Schema.isGreaterThanOrEqualTo(1)),
        categoryId: ExpenseCategoryId,
        memo: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(500))),
      }),
      success: Expense.pipe(HttpApiSchema.status(201)),
      error: [CashDrawerNotOpen, ExpenseCategoryInvalid, IdempotencyKeyReused],
    })
      .annotate(Access, Access.requires('cash_drawer:update'))
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.delete('removeExpense', '/expenses/:id', {
      params: { id: ExpenseId },
      success: HttpApiSchema.NoContent,
      error: [ExpenseNotFound, CashDrawerNotOpen],
    }).annotate(Access, Access.requires('cash_drawer:update')),
    HttpApiEndpoint.get('listCategories', '/settings/expense-categories', {
      success: Schema.Struct({ items: Schema.Array(ExpenseCategory) }),
    }).annotate(Access, Access.requires('cash_drawer:read')),
    HttpApiEndpoint.post('addCategory', '/settings/expense-categories', {
      payload: Schema.Struct({ name: Text(50).check(Schema.isTrimmed()) }),
      success: ExpenseCategory.pipe(HttpApiSchema.status(201)),
      error: ExpenseCategoryNameTaken,
    })
      .annotate(Access, Access.requires('setting.normal:update'))
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.delete('removeCategory', '/settings/expense-categories/:id', {
      params: { id: ExpenseCategoryId },
      success: HttpApiSchema.NoContent,
      error: ExpenseCategoryNotFound,
    }).annotate(Access, Access.requires('setting.normal:update')),
  )
  .middleware(Authorization) {}
