import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'
import { TenantId, UserId } from '../../identity/identity.ts'
import { LocalDate } from '../../patients/patient.ts'
import { Won } from '../receipts/receipt.ts'

// 설명은 `refine` 앞에 답니다. 뒤에 달면 OpenAPI 문서에서 빠집니다
export const ExpenseId = Schema.String.annotate({ description: '지출 ID입니다.' }).pipe(
  Schema.refine((value): value is Id<'expense'> => isId('expense', value)),
)
export const ExpenseCategoryId = Schema.String.annotate({ description: '지출 분류 ID입니다.' }).pipe(
  Schema.refine((value): value is Id<'expenseCategory'> => isId('expenseCategory', value)),
)

// `LocalDate`는 형식만 봐 `2026-02-30`도 받는데, 시재는 날짜로 하루 범위를 계산하므로 실제 날짜만 받습니다
export const CalendarDate = LocalDate.annotate({
  description: '날짜입니다. 형식은 `YYYY-MM-DD`이고 달력에 있는 날짜만 받습니다(`2026-02-30`은 400).',
}).check(
  Schema.makeFilter(
    (value: string) => {
      const time = Date.parse(`${value}T00:00:00Z`)
      return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value
    },
    { title: 'calendar date' },
  ),
)

export const CashDrawerStatus = Schema.Literals(['NOT_OPENED', 'OPEN', 'CLOSED', 'REOPENED']).annotate({
  identifier: 'CashDrawerStatus',
  title: '시재 상태',
  description:
    '열지 않음(`NOT_OPENED`), 열림(`OPEN`), 마감(`CLOSED`), 다시 열림(`REOPENED`)입니다. 마감 뒤 그날 현금 기록이 바뀌어도 `REOPENED`가 됩니다.',
})
export const CashDrawerCommand = Schema.Literals(['OPEN', 'CLOSE', 'REOPEN']).annotate({
  identifier: 'CashDrawerCommand',
  description: '시재 커맨드입니다. 개시(`OPEN`), 마감(`CLOSE`), 다시 열기(`REOPEN`)입니다.',
})

const Closing = Schema.Struct({
  countedAmount: Won.annotate({ description: '실사 금액입니다. 마감할 때 돈통에서 센 현금입니다.' }),
  expectedClosing: Schema.Int.annotate({ description: '마감할 때의 예상 마감 금액입니다.' }),
  difference: Schema.Int.annotate({ description: '차액입니다. `countedAmount − expectedClosing`입니다.' }),
  closedAt: Schema.String,
  closedBy: UserId,
}).annotate({
  description:
    '마감 기록입니다. 처음 마감하기 전에는 `null`이고, 다시 열린(`REOPENED`) 동안에도 마지막 마감 기록이 남습니다. 다시 마감하면 새 기록으로 바꾸고 지난 기록은 남기지 않습니다.',
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

// 선수금 현금 충전은 환자 원장이 생기면 `cashIn`에 더합니다
export const CashDrawer = Schema.Struct({
  date: LocalDate,
  status: CashDrawerStatus,
  openingAmount: Schema.NullOr(Won).annotate({ description: '시작 금액입니다. 열지 않았으면 `null`입니다.' }),
  carriedOver: Schema.Boolean.annotate({ description: '시작 금액을 앞 시재의 실사 금액에서 이어받았는지입니다.' }),
  cashIn: Schema.Int.annotate({
    description: '그날 현금 수납의 합입니다. 받은 날 취소한 결제의 남은 금액은 오가지 않은 돈이라 넣지 않습니다.',
  }),
  cashRefunds: Schema.Int.annotate({
    description:
      '그날 현금 환불의 합입니다. 지난 날 받은 현금 결제를 영수증 취소로 `VOIDED`하면 남은 금액을 취소한 날의 환불로 셉니다. 받은 날 취소하면 수납·환불 어느 쪽에도 넣지 않습니다.',
  }),
  expenses: Schema.Int.annotate({ description: '그날 지출의 합입니다.' }),
  expectedClosing: Schema.NullOr(Schema.Int).annotate({
    description: '예상 마감 금액입니다. `시작 + 현금 수납 − 지출 − 현금 환불`이고, 열지 않았으면 `null`입니다.',
  }),
  opened: Schema.NullOr(Schema.Struct({ at: Schema.String, by: UserId })).annotate({
    description: '개시 기록입니다. 열지 않았으면 `null`입니다.',
  }),
  closing: Schema.NullOr(Closing),
  reopened: Schema.NullOr(
    Schema.Struct({
      cause: Schema.Literals(['MANUAL', 'CHANGED_AFTER_CLOSE']),
      reason: Schema.NullOr(Schema.String),
      at: Schema.NullOr(Schema.String),
      by: Schema.NullOr(UserId),
    }),
  ).annotate({
    description:
      '마지막 마감 뒤 다시 열린 이유입니다. `MANUAL`은 `:reopen`이고, `CHANGED_AFTER_CLOSE`는 마감 뒤 그날 현금 원장이 바뀐 것입니다(이때 `reason`·`at`·`by`는 `null`). 둘 다면 `MANUAL`입니다. 다시 마감하면 `null`입니다.',
  }),
  version: Schema.Int.annotate({ description: '저장한 버전입니다. 열지 않았으면 0입니다.' }),
}).annotate({
  identifier: 'CashDrawer',
  title: '시재',
  description:
    '그날 시재입니다. 병원·날짜마다 하나이고, 현금 흐름은 저장하지 않고 읽을 때 그날(병원 시간대) 결제·환불·지출에서 계산합니다. 돈이 오간 날로 셉니다.',
})
export type CashDrawer = typeof CashDrawer.Type

// 현행 출금 사유입니다
export const ExpenseCategory = Schema.Struct({
  id: ExpenseCategoryId,
  tenantId: TenantId,
  name: Schema.String.annotate({ description: '분류 이름입니다. 병원 안에서 겹치지 않습니다.' }),
  createdAt: Schema.String,
}).annotate({
  identifier: 'ExpenseCategory',
  title: '지출 분류',
  description: '지출 분류(항목)입니다. 병원 설정입니다.',
})
export type ExpenseCategory = typeof ExpenseCategory.Type

export const Expense = Schema.Struct({
  id: ExpenseId,
  tenantId: TenantId,
  date: LocalDate.annotate({ description: '현금이 나간 날입니다. 그날 시재에 들어갑니다.' }),
  amount: Won,
  category: Schema.Struct({ id: ExpenseCategoryId, name: Schema.String }).annotate({
    description: '기록할 때의 지출 분류입니다. 분류를 지워도 이름이 남습니다.',
  }),
  memo: Schema.String,
  recordedBy: UserId,
  createdAt: Schema.String,
  deleted: Schema.NullOr(Schema.Struct({ at: Schema.String, by: UserId })).annotate({
    description: '지운 기록입니다. 지운 지출은 목록과 시재에서 빠지므로 응답에서는 늘 `null`입니다.',
  }),
  version: Schema.Int,
}).annotate({ identifier: 'Expense', title: '지출', description: '지출입니다. 시재에서 나간 현금입니다.' })
export type Expense = typeof Expense.Type

export class CashDrawerTransitionInvalid extends HttpApiError.Problem<CashDrawerTransitionInvalid>()(
  'CashDrawerTransitionInvalid',
  {
    type: problemType('CASH_DRAWER_TRANSITION_INVALID'),
    status: 409,
    title: 'Cash drawer status does not allow this command',
  },
  { code: Schema.tag('CASH_DRAWER_TRANSITION_INVALID'), currentStatus: CashDrawerStatus, command: CashDrawerCommand },
  { description: '`CASH_DRAWER_TRANSITION_INVALID`: 시재의 지금 상태에서는 이 커맨드를 보낼 수 없습니다.' },
) {}

export class CashDrawerNotOpen extends HttpApiError.Problem<CashDrawerNotOpen>()(
  'CashDrawerNotOpen',
  { type: problemType('CASH_DRAWER_NOT_OPEN'), status: 409, title: 'Cash drawer of the date is not open' },
  { code: Schema.tag('CASH_DRAWER_NOT_OPEN'), date: LocalDate, currentStatus: CashDrawerStatus },
  { description: '`CASH_DRAWER_NOT_OPEN`: 지출은 그날 시재가 열려 있을 때(`OPEN`·`REOPENED`)만 기록하거나 지웁니다.' },
) {}

export class CashDrawerDateInFuture extends HttpApiError.Problem<CashDrawerDateInFuture>()(
  'CashDrawerDateInFuture',
  { type: problemType('CASH_DRAWER_DATE_IN_FUTURE'), status: 422, title: 'Cash drawer date is in the future' },
  { code: Schema.tag('CASH_DRAWER_DATE_IN_FUTURE') },
  {
    description: '`CASH_DRAWER_DATE_IN_FUTURE`: 미래 날짜의 시재는 열 수 없습니다. 오늘과 지난 날짜는 열 수 있습니다.',
  },
) {}

export class CashDrawerCarryOverUnavailable extends HttpApiError.Problem<CashDrawerCarryOverUnavailable>()(
  'CashDrawerCarryOverUnavailable',
  {
    type: problemType('CASH_DRAWER_CARRY_OVER_UNAVAILABLE'),
    status: 422,
    title: 'No earlier closed cash drawer to carry over',
  },
  { code: Schema.tag('CASH_DRAWER_CARRY_OVER_UNAVAILABLE') },
  {
    description:
      '`CASH_DRAWER_CARRY_OVER_UNAVAILABLE`: 이어받을 앞 시재가 없습니다. 이 날짜 전에 마감한 시재가 없거나, 그중 가장 늦은 시재가 다시 열려(`:reopen` 또는 마감 뒤 현금 기록이 바뀜) 실사 금액을 믿을 수 없습니다.',
  },
) {}

export class ExpenseNotFound extends HttpApiError.Problem<ExpenseNotFound>()(
  'ExpenseNotFound',
  { type: problemType('EXPENSE_NOT_FOUND'), status: 404, title: 'Expense not found' },
  { code: Schema.tag('EXPENSE_NOT_FOUND') },
  {
    description:
      '`EXPENSE_NOT_FOUND`: 요청한 ID의 지출이 없습니다. 이미 지운 지출과 다른 병원의 지출도 없는 것과 같습니다.',
  },
) {}

export class ExpenseCategoryInvalid extends HttpApiError.Problem<ExpenseCategoryInvalid>()(
  'ExpenseCategoryInvalid',
  { type: problemType('EXPENSE_CATEGORY_INVALID'), status: 422, title: 'Expense category does not exist' },
  { code: Schema.tag('EXPENSE_CATEGORY_INVALID') },
  { description: '`EXPENSE_CATEGORY_INVALID`: 지출에 고른 지출 분류가 없습니다.' },
) {}

export class ExpenseCategoryNotFound extends HttpApiError.Problem<ExpenseCategoryNotFound>()(
  'ExpenseCategoryNotFound',
  { type: problemType('EXPENSE_CATEGORY_NOT_FOUND'), status: 404, title: 'Expense category not found' },
  { code: Schema.tag('EXPENSE_CATEGORY_NOT_FOUND') },
  { description: '`EXPENSE_CATEGORY_NOT_FOUND`: 요청한 ID의 지출 분류가 없습니다.' },
) {}

export class ExpenseCategoryNameTaken extends HttpApiError.Problem<ExpenseCategoryNameTaken>()(
  'ExpenseCategoryNameTaken',
  { type: problemType('EXPENSE_CATEGORY_NAME_TAKEN'), status: 409, title: 'Expense category name is already taken' },
  { code: Schema.tag('EXPENSE_CATEGORY_NAME_TAKEN') },
  { description: '`EXPENSE_CATEGORY_NAME_TAKEN`: 병원에 같은 이름의 지출 분류가 이미 있습니다.' },
) {}
