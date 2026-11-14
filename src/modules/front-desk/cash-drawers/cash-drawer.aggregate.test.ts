import { rejected, success } from '../../../shared/decision/testing.ts'
import { describe, expect, it } from 'vitest'
import type { DecisionContext } from '../../../shared/decision/decision-context.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { TEST_TENANT } from '../../identity/auth/testing.ts'
import {
  decideClose,
  decideOpen,
  decideRecordExpense,
  decideRemoveExpense,
  decideReopen,
} from './cash-drawer.aggregate.ts'
import type { CashDrawerRecord, Expense, ExpenseCategory } from './cash-drawer-model.ts'
import { cashDrawerView } from './cash-drawer.view.ts'
import type { LedgerEntry } from './cash-ledger.ts'

/**
 * 시재 판정 함수의 테스트입니다. given(그날 시재와 원장) / when(커맨드) / then(쓸 시재·지출과 이벤트, 또는 거부)으로
 * 씁니다. 현금 흐름 계산은 `cash-drawer.test.ts`·`cash-ledger.test.ts`가, 저장은 `cash-drawers.test.ts`가 봅니다.
 */

const TODAY = '2026-11-13'
const USER = 'usr_01JBQ000000000000000000001' as Id<'user'>
const context: DecisionContext = {
  at: '2026-11-13T09:00:00.000Z',
  today: TODAY,
  tenantId: TEST_TENANT.id,
  userId: USER,
}
const cashIn = (amount: number, ref = 'pay_1'): LedgerEntry => ({ kind: 'PAYMENT', method: 'CASH', amount, ref })

const opened = (overrides: Partial<CashDrawerRecord> = {}): CashDrawerRecord => ({
  tenantId: TEST_TENANT.id,
  date: TODAY,
  openingAmount: 100_000,
  carriedOver: false,
  openedAt: '2026-11-13T00:00:00.000Z',
  openedBy: USER,
  closing: null,
  reopened: null,
  version: 1,
  ...overrides,
})

const notOpened = cashDrawerView(TODAY, null, [])

/** `ledger`로 마감한 시재입니다. */
const closedWith = (ledger: ReadonlyArray<LedgerEntry>, date = TODAY) =>
  success(decideClose(cashDrawerView(date, opened({ date }), ledger), 110_000, { ...context, today: date })).drawer!
    .drawer

describe('decideOpen', () => {
  it('시작 금액으로 열고 시재 변경 이벤트를 냅니다', () => {
    const then = success(decideOpen(TODAY, { openingAmount: 50_000 }, notOpened, null, context))

    expect(then.drawer).toMatchObject({
      drawer: { date: TODAY, openingAmount: 50_000, carriedOver: false, openedBy: USER, version: 1 },
      expectedVersion: null,
    })
    expect(then.events).toMatchObject([{ type: 'cash_drawer.changed', subject: TODAY, data: { date: TODAY } }])
  })

  it('앞서 마감한 시재의 센 금액을 이어받습니다', () => {
    const previous = cashDrawerView('2026-11-12', closedWith([cashIn(10_000)], '2026-11-12'), [cashIn(10_000)])

    const then = success(decideOpen(TODAY, { carryOver: true }, notOpened, previous, context))

    expect(then.drawer?.drawer).toMatchObject({ openingAmount: 110_000, carriedOver: true })
  })

  it('앞 시재가 마감 뒤 원장이 바뀌었으면 이어받지 않습니다', () => {
    const changed = cashDrawerView('2026-11-12', closedWith([cashIn(10_000)], '2026-11-12'), [
      cashIn(10_000),
      cashIn(5_000, 'pay_2'),
    ])

    expect(changed.drawer.status).toBe('REOPENED')
    rejected(decideOpen(TODAY, { carryOver: true }, notOpened, changed, context), {
      _tag: 'CashDrawerCarryOverUnavailable',
    })
    rejected(decideOpen(TODAY, { carryOver: true }, notOpened, null, context), {
      _tag: 'CashDrawerCarryOverUnavailable',
    })
  })

  it('시작 금액과 이어받기를 둘 다 보내거나 둘 다 빠뜨리면 400입니다', () => {
    rejected(decideOpen(TODAY, {}, notOpened, null, context), {
      _tag: 'ValidationFailed',
      violations: [{ field: 'openingAmount', code: 'INVALID_VALUE' }],
    })
    rejected(decideOpen(TODAY, { openingAmount: 0, carryOver: true }, notOpened, null, context), {
      _tag: 'ValidationFailed',
      violations: [{ field: 'carryOver', code: 'INVALID_VALUE' }],
    })
  })

  it('내일 시재와 이미 연 시재는 열지 않습니다', () => {
    rejected(decideOpen('2026-11-14', { openingAmount: 0 }, notOpened, null, context), {
      _tag: 'CashDrawerDateInFuture',
    })
    rejected(decideOpen(TODAY, { openingAmount: 0 }, cashDrawerView(TODAY, opened(), []), null, context), {
      _tag: 'CashDrawerTransitionInvalid',
      currentStatus: 'OPEN',
      command: 'OPEN',
    })
  })
})

describe('decideClose와 decideReopen', () => {
  it('센 금액과 예상 마감 금액의 차이와 원장 지문을 남겨 마감합니다', () => {
    const state = cashDrawerView(TODAY, opened(), [cashIn(10_000)])

    const then = success(decideClose(state, 108_000, context))

    expect(then.drawer).toMatchObject({
      drawer: {
        closing: { countedAmount: 108_000, expectedClosing: 110_000, difference: -2_000, closedBy: USER },
        version: 2,
      },
      expectedVersion: 1,
    })
    expect(cashDrawerView(TODAY, then.drawer!.drawer, [cashIn(10_000)]).drawer.status).toBe('CLOSED')
  })

  it('마감 뒤 원장이 바뀐 시재는 다시 마감할 수 있습니다', () => {
    const state = cashDrawerView(TODAY, closedWith([cashIn(10_000)]), [cashIn(10_000), cashIn(5_000, 'pay_2')])

    expect(success(decideClose(state, 115_000, context)).drawer?.drawer.closing?.expectedClosing).toBe(115_000)
  })

  it('열지 않은 시재는 마감하지 않고, 마감한 시재만 사유와 함께 다시 엽니다', () => {
    rejected(decideClose(notOpened, 0, context), {
      _tag: 'CashDrawerTransitionInvalid',
      currentStatus: 'NOT_OPENED',
      command: 'CLOSE',
    })

    const closed = cashDrawerView(TODAY, closedWith([]), [])
    const reopened = success(decideReopen(closed, '다시 셈', context)).drawer!.drawer

    expect(reopened.reopened).toEqual({ reason: '다시 셈', at: context.at, by: USER })
    rejected(decideReopen(cashDrawerView(TODAY, reopened, []), '또', context), {
      _tag: 'CashDrawerTransitionInvalid',
      currentStatus: 'REOPENED',
      command: 'REOPEN',
    })
  })
})

describe('decideRecordExpense와 decideRemoveExpense', () => {
  const category: ExpenseCategory = {
    id: 'exc_01JBQ000000000000000000001' as Id<'expenseCategory'>,
    tenantId: TEST_TENANT.id,
    name: '비품',
    createdAt: '2026-11-01T00:00:00.000Z',
  }
  const input = { date: TODAY, amount: 3_000, categoryId: category.id }
  const EXPENSE_ID = 'exp_01JBQ000000000000000000001' as Id<'expense'>
  const openState = cashDrawerView(TODAY, opened(), [])

  it('열린 시재에 항목 이름을 담아 지출을 기록합니다', () => {
    const then = success(decideRecordExpense(openState, category, input, EXPENSE_ID, context))

    expect(then.expense).toMatchObject({
      expense: { id: EXPENSE_ID, amount: 3_000, category: { id: category.id, name: '비품' }, memo: '', deleted: null },
      expectedVersion: null,
    })
    expect(then.events).toMatchObject([{ type: 'cash_drawer.changed', data: { date: TODAY } }])
  })

  it('열리지 않은 시재에는 기록하지 않고, 없는 항목은 거부합니다', () => {
    rejected(decideRecordExpense(notOpened, category, input, EXPENSE_ID, context), {
      _tag: 'CashDrawerNotOpen',
      currentStatus: 'NOT_OPENED',
      date: TODAY,
    })
    rejected(decideRecordExpense(openState, null, input, EXPENSE_ID, context), { _tag: 'ExpenseCategoryInvalid' })
  })

  it('지출을 지운 기록으로 남기고, 없거나 이미 지운 지출은 404입니다', () => {
    const expense = success(decideRecordExpense(openState, category, input, EXPENSE_ID, context)).expense.expense

    const then = success(decideRemoveExpense(expense, openState, context))
    const removed: Expense = then.expense!.expense

    expect(removed).toMatchObject({ deleted: { at: context.at, by: USER }, version: 2 })
    rejected(decideRemoveExpense(removed, openState, context), { _tag: 'ExpenseNotFound' })
    rejected(decideRemoveExpense(null, null, context), { _tag: 'ExpenseNotFound' })
  })

  it('마감한 날의 지출은 지우지 않습니다', () => {
    const expense = success(decideRecordExpense(openState, category, input, EXPENSE_ID, context)).expense.expense

    rejected(decideRemoveExpense(expense, cashDrawerView(TODAY, closedWith([]), []), context), {
      _tag: 'CashDrawerNotOpen',
      currentStatus: 'CLOSED',
      date: TODAY,
    })
  })
})
