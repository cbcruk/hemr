import { Context, Effect, Layer, Option, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { CashDrawerRecord, Expense, ExpenseCategory } from './cash-drawer-model.ts'

/**
 * 한 번에 쓰는 시재·지출 변경입니다. 바꾸는 행은 읽은 버전(`expectedVersion`, 새 행이면 `null`)이 그대로일 때만
 * 씁니다. 같은 트랜잭션에서 읽고 판정한 뒤 쓰므로 어긋나면 결함입니다.
 */
export interface CashDrawerChanges {
  drawer?: { drawer: CashDrawerRecord; expectedVersion: number | null }
  expense?: { expense: Expense; expectedVersion: number | null }
  events?: ReadonlyArray<DomainEvent>
}

interface Store {
  drawers: Map<string, CashDrawerRecord>
  expenses: Map<string, Expense>
  categories: Map<string, ExpenseCategory>
}

const drawerKey = (tenantId: string, date: string) => `${tenantId}/${date}`
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const byExpense = (a: Expense, b: Expense) =>
  compare(a.date, b.date) || compare(a.createdAt, b.createdAt) || compare(a.id, b.id)

/** 시재, 지출, 지출 항목 저장소입니다. 시재와 지출 쓰기는 `commit` 하나입니다. */
export class CashDrawerRepository extends Context.Service<
  CashDrawerRepository,
  {
    findDrawer(tenantId: Id<'tenant'>, date: string): Effect.Effect<Option.Option<CashDrawerRecord>>
    /** `date`보다 앞이고 마감한 적이 있는 시재 중 가장 늦은 날입니다. 시작 금액을 이어받을 때 씁니다. */
    lastClosedBefore(tenantId: Id<'tenant'>, date: string): Effect.Effect<Option.Option<CashDrawerRecord>>
    findExpense(tenantId: Id<'tenant'>, id: Id<'expense'>): Effect.Effect<Option.Option<Expense>>
    /** `from`–`to`(둘 다 포함) 날짜의 지우지 않은 지출입니다. 날짜, 기록한 시각, ID 순서입니다. */
    listExpenses(tenantId: Id<'tenant'>, range: { from: string; to: string }): Effect.Effect<ReadonlyArray<Expense>>
    commit(changes: CashDrawerChanges): Effect.Effect<void>
    /** 이름 순서입니다. */
    listCategories(tenantId: Id<'tenant'>): Effect.Effect<ReadonlyArray<ExpenseCategory>>
    findCategory(tenantId: Id<'tenant'>, id: Id<'expenseCategory'>): Effect.Effect<Option.Option<ExpenseCategory>>
    /** 지출 항목을 더합니다. 같은 이름이 이미 있으면 쓰지 않고 `false`입니다. */
    insertCategory(category: ExpenseCategory): Effect.Effect<boolean>
    /** 지출 항목을 지웁니다. 없으면 `false`입니다. 기록한 지출은 항목 이름을 따로 남겨 영향이 없습니다. */
    removeCategory(tenantId: Id<'tenant'>, id: Id<'expenseCategory'>): Effect.Effect<boolean>
  }
>()('hemr/front-desk/CashDrawerRepository') {
  /** 프로세스 메모리에 보관합니다. 이벤트는 `Outbox`에 씁니다. */
  static readonly layerMemory = Layer.effect(
    CashDrawerRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make<Store>({ drawers: new Map(), expenses: new Map(), categories: new Map() })
      const outbox = yield* Outbox

      return CashDrawerRepository.of({
        findDrawer: (tenantId, date) =>
          Ref.get(store).pipe(Effect.map((all) => Option.fromNullishOr(all.drawers.get(drawerKey(tenantId, date))))),
        lastClosedBefore: (tenantId, date) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              Option.fromNullishOr(
                [...all.drawers.values()]
                  .filter((each) => each.tenantId === tenantId && each.date < date && each.closing !== null)
                  .sort((a, b) => compare(b.date, a.date))[0],
              ),
            ),
          ),
        findExpense: (tenantId, id) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              Option.filter(Option.fromNullishOr(all.expenses.get(id)), (each) => each.tenantId === tenantId),
            ),
          ),
        listExpenses: (tenantId, range) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              [...all.expenses.values()]
                .filter(
                  (each) =>
                    each.tenantId === tenantId &&
                    each.deleted === null &&
                    each.date >= range.from &&
                    each.date <= range.to,
                )
                .sort(byExpense),
            ),
          ),
        commit: (changes) =>
          Effect.gen(function* () {
            // 비교와 쓰기를 `Ref.modify` 한 번에 해, 하나라도 어긋나면 아무것도 쓰지 않습니다
            const ok = yield* Ref.modify(store, (all): [boolean, Store] => {
              const drawer = changes.drawer
              const expense = changes.expense
              if (
                drawer !== undefined &&
                (all.drawers.get(drawerKey(drawer.drawer.tenantId, drawer.drawer.date))?.version ?? null) !==
                  drawer.expectedVersion
              ) {
                return [false, all]
              }
              if (expense !== undefined) {
                const current = all.expenses.get(expense.expense.id)
                if (current !== undefined && current.tenantId !== expense.expense.tenantId) return [false, all]
                if ((current?.version ?? null) !== expense.expectedVersion) return [false, all]
              }
              const next = { ...all, drawers: new Map(all.drawers), expenses: new Map(all.expenses) }
              if (drawer !== undefined) {
                next.drawers.set(drawerKey(drawer.drawer.tenantId, drawer.drawer.date), drawer.drawer)
              }
              if (expense !== undefined) next.expenses.set(expense.expense.id, expense.expense)
              return [true, next]
            })
            if (!ok) return yield* Effect.die(new Error('cash drawer changes do not match the stored versions'))
            yield* outbox.append(changes.events ?? [])
          }),
        listCategories: (tenantId) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              [...all.categories.values()]
                .filter((each) => each.tenantId === tenantId)
                .sort((a, b) => compare(a.name, b.name) || compare(a.id, b.id)),
            ),
          ),
        findCategory: (tenantId, id) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              Option.filter(Option.fromNullishOr(all.categories.get(id)), (each) => each.tenantId === tenantId),
            ),
          ),
        insertCategory: (category) =>
          Ref.modify(store, (all): [boolean, Store] => {
            const taken = [...all.categories.values()].some(
              (each) => each.tenantId === category.tenantId && each.name === category.name,
            )
            if (taken) return [false, all]
            return [true, { ...all, categories: new Map(all.categories).set(category.id, category) }]
          }),
        removeCategory: (tenantId, id) =>
          Ref.modify(store, (all): [boolean, Store] => {
            if (all.categories.get(id)?.tenantId !== tenantId) return [false, all]
            const categories = new Map(all.categories)
            categories.delete(id)
            return [true, { ...all, categories }]
          }),
      })
    }),
  )

  /** SQL `cash_drawers`·`expenses`·`expense_categories` 테이블에 보관합니다. 쓰기와 이벤트를 한 트랜잭션에서 씁니다. */
  static readonly layerSql = Layer.effect(
    CashDrawerRepository,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const outbox = yield* Outbox

      interface DrawerRow {
        tenantId: string
        date: string
        openingAmount: number
        carriedOver: number
        openedAt: string
        openedBy: string
        closing: string | null
        reopened: string | null
        version: number
      }

      const toDrawer = (row: DrawerRow): CashDrawerRecord => ({
        tenantId: row.tenantId as Id<'tenant'>,
        date: row.date,
        openingAmount: row.openingAmount,
        carriedOver: row.carriedOver === 1,
        openedAt: row.openedAt,
        openedBy: row.openedBy as Id<'user'>,
        closing: row.closing === null ? null : (JSON.parse(row.closing) as CashDrawerRecord['closing']),
        reopened: row.reopened === null ? null : (JSON.parse(row.reopened) as CashDrawerRecord['reopened']),
        version: row.version,
      })

      const drawerColumns = sql`
        tenant_id AS tenantId, date, opening_amount AS openingAmount, carried_over AS carriedOver,
        opened_at AS openedAt, opened_by AS openedBy, closing, reopened, version
      `

      interface ExpenseRow {
        id: string
        tenantId: string
        date: string
        amount: number
        categoryId: string
        categoryName: string
        memo: string
        recordedBy: string
        createdAt: string
        deleted: string | null
        version: number
      }

      const toExpense = (row: ExpenseRow): Expense => ({
        id: row.id as Expense['id'],
        tenantId: row.tenantId as Expense['tenantId'],
        date: row.date,
        amount: row.amount,
        category: { id: row.categoryId as Expense['category']['id'], name: row.categoryName },
        memo: row.memo,
        recordedBy: row.recordedBy as Expense['recordedBy'],
        createdAt: row.createdAt,
        deleted: row.deleted === null ? null : (JSON.parse(row.deleted) as Expense['deleted']),
        version: row.version,
      })

      const expenseColumns = sql`
        id, tenant_id AS tenantId, date, amount, category_id AS categoryId, category_name AS categoryName, memo,
        recorded_by AS recordedBy, created_at AS createdAt, deleted, version
      `

      const categoryColumns = sql`id, tenant_id AS tenantId, name, created_at AS createdAt`

      const writeDrawer = ({ drawer, expectedVersion }: NonNullable<CashDrawerChanges['drawer']>) => {
        const values = {
          opening_amount: drawer.openingAmount,
          carried_over: drawer.carriedOver ? 1 : 0,
          opened_at: drawer.openedAt,
          opened_by: drawer.openedBy,
          closing: drawer.closing === null ? null : JSON.stringify(drawer.closing),
          reopened: drawer.reopened === null ? null : JSON.stringify(drawer.reopened),
          version: drawer.version,
        }
        return expectedVersion === null
          ? sql<{ date: string }>`
              INSERT INTO cash_drawers ${sql.insert({ tenant_id: drawer.tenantId, date: drawer.date, ...values })}
              ON CONFLICT (tenant_id, date) DO NOTHING
              RETURNING date
            `
          : sql<{ date: string }>`
              UPDATE cash_drawers SET ${sql.update(values)}
              WHERE tenant_id = ${drawer.tenantId} AND date = ${drawer.date} AND version = ${expectedVersion}
              RETURNING date
            `
      }

      const writeExpense = ({ expense, expectedVersion }: NonNullable<CashDrawerChanges['expense']>) => {
        const values = {
          deleted: expense.deleted === null ? null : JSON.stringify(expense.deleted),
          version: expense.version,
        }
        return expectedVersion === null
          ? sql<{ id: string }>`
              INSERT INTO expenses ${sql.insert({
                id: expense.id,
                tenant_id: expense.tenantId,
                date: expense.date,
                amount: expense.amount,
                category_id: expense.category.id,
                category_name: expense.category.name,
                memo: expense.memo,
                recorded_by: expense.recordedBy,
                created_at: expense.createdAt,
                ...values,
              })}
              ON CONFLICT (id) DO NOTHING
              RETURNING id
            `
          : sql<{ id: string }>`
              UPDATE expenses SET ${sql.update(values)}
              WHERE id = ${expense.id} AND tenant_id = ${expense.tenantId} AND version = ${expectedVersion}
              RETURNING id
            `
      }

      return CashDrawerRepository.of({
        findDrawer: (tenantId, date) =>
          sql<DrawerRow>`
            SELECT ${drawerColumns} FROM cash_drawers WHERE tenant_id = ${tenantId} AND date = ${date}
          `.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toDrawer)),
            Effect.orDie,
          ),
        lastClosedBefore: (tenantId, date) =>
          sql<DrawerRow>`
            SELECT ${drawerColumns} FROM cash_drawers
            WHERE tenant_id = ${tenantId} AND date < ${date} AND closing IS NOT NULL
            ORDER BY date DESC LIMIT 1
          `.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toDrawer)),
            Effect.orDie,
          ),
        findExpense: (tenantId, id) =>
          sql<ExpenseRow>`SELECT ${expenseColumns} FROM expenses WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toExpense)),
            Effect.orDie,
          ),
        listExpenses: (tenantId, range) =>
          sql<ExpenseRow>`
            SELECT ${expenseColumns} FROM expenses
            WHERE tenant_id = ${tenantId} AND deleted IS NULL AND date >= ${range.from} AND date <= ${range.to}
            ORDER BY date, created_at, id
          `.pipe(
            Effect.map((rows) => rows.map(toExpense)),
            Effect.orDie,
          ),
        commit: (changes) =>
          Effect.gen(function* () {
            if (changes.drawer !== undefined && (yield* writeDrawer(changes.drawer)).length === 0) {
              return yield* Effect.die(new Error('cash drawer does not match the stored version'))
            }
            if (changes.expense !== undefined && (yield* writeExpense(changes.expense)).length === 0) {
              return yield* Effect.die(new Error('expense does not match the stored version'))
            }
            yield* outbox.append(changes.events ?? [])
          }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die)),
        listCategories: (tenantId) =>
          sql<ExpenseCategory>`
            SELECT ${categoryColumns} FROM expense_categories WHERE tenant_id = ${tenantId} ORDER BY name, id
          `.pipe(Effect.orDie),
        findCategory: (tenantId, id) =>
          sql<ExpenseCategory>`
            SELECT ${categoryColumns} FROM expense_categories WHERE id = ${id} AND tenant_id = ${tenantId}
          `.pipe(
            Effect.map((rows) => Option.fromNullishOr(rows[0])),
            Effect.orDie,
          ),
        insertCategory: (category) =>
          sql<{ id: string }>`
            INSERT INTO expense_categories ${sql.insert({
              id: category.id,
              tenant_id: category.tenantId,
              name: category.name,
              created_at: category.createdAt,
            })}
            ON CONFLICT DO NOTHING
            RETURNING id
          `.pipe(
            Effect.map((rows) => rows.length > 0),
            Effect.orDie,
          ),
        removeCategory: (tenantId, id) =>
          sql<{ id: string }>`
            DELETE FROM expense_categories WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id
          `.pipe(
            Effect.map((rows) => rows.length > 0),
            Effect.orDie,
          ),
      })
    }),
  )
}
