import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from 'effect/http-api'
import { IdempotencyKey, IdempotencyKeyReused } from '../../../shared/http/idempotency.ts'
import { ValidationFailed } from '../../../shared/problem/problem.ts'
import { Access } from '../../identity/auth/access.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import { Won } from '../receipts/receipt.ts'
import {
  CalendarDate,
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
const dateParams = { date: CalendarDate }
/** 공백만 있는 글은 받지 않습니다. */
const Text = (max: number) => Schema.String.check(Schema.isMaxLength(max), Schema.isPattern(/\S/))

/**
 * 시재 그룹의 구현 메모입니다. API 설명은 `OpenApi.Description`에 있습니다.
 *
 * 조회는 `cash_drawer:read`, 시재 커맨드와 지출 쓰기는
 * `cash_drawer:update`, 지출 항목 설정은 `setting.normal:update`가 필요합니다.
 */
export class CashDrawersApi extends HttpApiGroup.make('cashDrawers')
  .add(
    HttpApiEndpoint.get('get', '/cash-drawers/:date', {
      params: dateParams,
      success: CashDrawer,
    })
      .annotate(Access, Access.requires('cash_drawer:read'))
      .annotate(OpenApi.Summary, '그날 시재'),
    HttpApiEndpoint.post('open', '/cash-drawers/:date::open', {
      params: dateParams,
      payload: Schema.Struct({
        openingAmount: Schema.optionalKey(Won.annotate({ description: '시작 금액입니다.' })),
        carryOver: Schema.optionalKey(
          Schema.Boolean.annotate({
            description:
              '앞서 마감한 시재 중 가장 늦은 날의 실사 금액을 시작 금액으로 이어받습니다. 그 시재가 없거나 다시 열렸으면 422 `CASH_DRAWER_CARRY_OVER_UNAVAILABLE`입니다.',
          }),
        ),
      }).annotate({
        description:
          '시재 개시 본문입니다. 시작 금액(`openingAmount`)이나 `carryOver: true` 중 하나만 보냅니다. 둘 다 보내거나 둘 다 없으면(`carryOver: false`만 보내도) 400입니다.',
      }),
      success: CashDrawer,
      error: [CashDrawerTransitionInvalid, CashDrawerDateInFuture, CashDrawerCarryOverUnavailable, ValidationFailed],
    })
      .annotate(Access, Access.requires('cash_drawer:update'))
      .annotate(OpenApi.Summary, '시재 개시')
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.post('close', '/cash-drawers/:date::close', {
      params: dateParams,
      payload: Schema.Struct({
        countedAmount: Won.annotate({ description: '실사 금액입니다. 돈통에서 센 현금입니다.' }),
      }),
      success: CashDrawer,
      error: CashDrawerTransitionInvalid,
    })
      .annotate(Access, Access.requires('cash_drawer:update'))
      .annotate(OpenApi.Summary, '시재 마감')
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.post('reopen', '/cash-drawers/:date::reopen', {
      params: dateParams,
      payload: Schema.Struct({
        reason: Text(500).annotate({ description: '다시 여는 사유입니다. 500자까지이고 공백만은 안 됩니다.' }),
      }),
      success: CashDrawer,
      error: CashDrawerTransitionInvalid,
    })
      .annotate(Access, Access.requires('cash_drawer:update'))
      .annotate(OpenApi.Summary, '시재 다시 열기 (마감 뒤)')
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.get('listExpenses', '/expenses', {
      query: { from: CalendarDate, to: CalendarDate },
      success: Schema.Struct({ items: Schema.Array(Expense) }).annotate({ description: '기간 안의 지출입니다.' }),
      error: ValidationFailed,
    })
      .annotate(Access, Access.requires('cash_drawer:read'))
      .annotate(OpenApi.Summary, '지출 목록 (`from`–`to` 포함, 31일까지)')
      .annotate(
        OpenApi.Description,
        '`from`부터 `to`까지(둘 다 포함) 날짜의 지우지 않은 지출입니다. 31일을 넘거나 `from`이 `to`보다 늦으면 400입니다.',
      ),
    HttpApiEndpoint.post('recordExpense', '/expenses', {
      headers: { 'idempotency-key': IdempotencyKey },
      payload: Schema.Struct({
        date: CalendarDate,
        // 이름 없는 공용 Schema(`Won`)를 좁히면 그 설명이 위에 남으므로, 설명을 먼저 달고 검사합니다
        amount: Schema.Int.annotate({ description: '지출 금액(원)입니다. 1원 이상입니다.' }).check(
          Schema.isGreaterThanOrEqualTo(1),
          Schema.isLessThanOrEqualTo(10_000_000_000),
        ),
        categoryId: ExpenseCategoryId,
        memo: Schema.optionalKey(
          Schema.String.check(Schema.isMaxLength(500)).annotate({ description: '메모입니다. 500자까지입니다.' }),
        ),
      }).annotate({
        description:
          '지출 본문입니다. `date`는 현금이 나간 날이고, 그날 시재가 열려 있어야 합니다(`OPEN`·`REOPENED`, 아니면 409 `CASH_DRAWER_NOT_OPEN`).',
      }),
      success: Expense.pipe(HttpApiSchema.status(201)),
      error: [CashDrawerNotOpen, ExpenseCategoryInvalid, IdempotencyKeyReused],
    })
      .annotate(Access, Access.requires('cash_drawer:update'))
      .annotate(OpenApi.Summary, '지출 기록')
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.delete('removeExpense', '/expenses/:id', {
      params: { id: ExpenseId },
      success: HttpApiSchema.NoContent.annotate({ description: '지출을 지웠습니다.' }),
      error: [ExpenseNotFound, CashDrawerNotOpen],
    })
      .annotate(Access, Access.requires('cash_drawer:update'))
      .annotate(OpenApi.Summary, '지출 지우기'),
    HttpApiEndpoint.get('listCategories', '/settings/expense-categories', {
      success: Schema.Struct({ items: Schema.Array(ExpenseCategory) }).annotate({
        description: '병원의 지출 분류입니다.',
      }),
    })
      .annotate(Access, Access.requires('cash_drawer:read'))
      .annotate(OpenApi.Summary, '지출 분류 목록 (이름 순서)'),
    HttpApiEndpoint.post('addCategory', '/settings/expense-categories', {
      payload: Schema.Struct({
        name: Text(50)
          .check(Schema.isTrimmed())
          .annotate({ description: '분류 이름입니다. 50자까지이고 앞뒤 공백이 없어야 합니다.' }),
      }),
      success: ExpenseCategory.pipe(HttpApiSchema.status(201)),
      error: ExpenseCategoryNameTaken,
    })
      .annotate(Access, Access.requires('setting.normal:update'))
      .annotate(OpenApi.Summary, '지출 분류 더하기')
      .annotate(HttpApi.PayloadParseOptions, strict),
    HttpApiEndpoint.delete('removeCategory', '/settings/expense-categories/:id', {
      params: { id: ExpenseCategoryId },
      success: HttpApiSchema.NoContent.annotate({ description: '지출 분류를 지웠습니다.' }),
      error: ExpenseCategoryNotFound,
    })
      .annotate(Access, Access.requires('setting.normal:update'))
      .annotate(OpenApi.Summary, '지출 분류 지우기'),
  )
  .annotate(
    OpenApi.Description,
    '시재와 지출입니다. 시재는 병원·날짜마다 하나이고 개시(`:open`), 마감(`:close`), 다시 열기(`:reopen`)로 옮깁니다. 현금 흐름은 읽을 때 그날 결제·환불·지출에서 계산하고, 마감 뒤 그날 현금 기록이 바뀌면 다시 열립니다(`REOPENED`). 미래 날짜는 열 수 없고(422) 오늘과 지난 날짜는 열 수 있습니다. 수납은 시재를 보지 않습니다. 지출은 그날 시재가 열려 있을 때만 기록하거나 지우고, 지출 기록은 `Idempotency-Key`가 필수입니다. 지출 분류는 병원 설정입니다.',
  )
  .middleware(Authorization) {}
