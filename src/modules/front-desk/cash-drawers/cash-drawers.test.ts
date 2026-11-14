import { Effect, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import type { Transaction } from '../../../shared/db/transaction.ts'
import { runPolicyOnce } from '../../../shared/events/policy.ts'
import type { PolicyCursor } from '../../../shared/events/policy.ts'
import { createVisitDraft } from '../../clinical/encounters/encounter-draft.policy.ts'
import type { VisitRepository } from '../visits/visit-repository.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { EncounterRepository } from '../../clinical/encounters/encounter-repository.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'
import { Patients } from '../../patients/patients.ts'
import { Receipts } from '../receipts/receipts.ts'
import { Visits } from '../visits/visits.ts'
import { CashDrawers } from './cash-drawers.ts'

const desk = testMember({ role: 'FRONT_DESK' })

type Services =
  | CashDrawers
  | Receipts
  | Visits
  | Patients
  | EncounterRepository
  | Outbox
  | PolicyCursor
  | Transaction
  | VisitRepository
  | CurrentAccess

const run = <A, E>(program: Effect.Effect<A, E, Services>, store: 'memory' | 'sqlite') =>
  Effect.runPromise(
    program.pipe(
      Effect.provideService(CurrentAccess, desk.access),
      Effect.provide(
        Layer.merge(CashDrawers.layer, Receipts.layer).pipe(
          Layer.provideMerge(Visits.layer),
          Layer.provideMerge(Patients.layer),
          Layer.provideMerge(desk.seed),
          Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
          Layer.provideMerge(TestPatientCrypto),
        ),
      ),
    ),
  )

const failure = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.flip(effect)

/** 오늘(병원 시간대)입니다. 시재는 오늘 이후를 열 수 없습니다. */
const today = () => clinicDate(Date.now())

/** 비급여 처방 하나(`amount`원)가 있는 일반 내원을 현금으로 수납합니다. */
const paidInCash = (amount: number) =>
  Effect.gen(function* () {
    const patient = yield* (yield* Patients).register({ name: '홍길동' })
    const visit = yield* (yield* Visits).checkIn({ patientId: patient.id, coverage: 'SELF_PAY' })
    // 진료 초안은 접수 정책이 만듭니다(결정 M1)
    yield* runPolicyOnce(createVisitDraft)
    const encounters = yield* EncounterRepository
    const encounter = Option.getOrThrow(
      yield* encounters.findById(visit.tenantId, visit.encounterId as Id<'encounter'>),
    )
    yield* encounters.save(
      {
        ...encounter,
        prescriptionLines: [
          {
            id: 'pl_01JBQ000000000000000000001' as Id<'prescriptionLine'>,
            kind: 'NONBENEFIT',
            feeCode: null,
            categoryCode: '90001001',
            name: '약침',
            dose: { perDay: 1, days: 1 },
            unitPrice: amount,
            amount,
            prn: false,
          },
        ],
        version: encounter.version + 1,
      },
      { expectedVersion: encounter.version },
    )
    const receipts = yield* Receipts
    const quote = yield* receipts.quote(visit.id, {})
    return yield* receipts.checkout(visit.id, {
      quoteId: quote.quoteId,
      payments: [{ method: 'CASH', amount: { taxable: 0, taxExempt: amount } }],
      idempotencyKey: `checkout-${visit.id}`,
    })
  })

describe.each(['memory', 'sqlite'] as const)('CashDrawers (%s)', (store) => {
  it('opens, counts the cash of the day, closes with the difference and reopens with a reason', async () => {
    const result = await run(
      Effect.gen(function* () {
        const drawers = yield* CashDrawers
        const date = today()
        const before = yield* drawers.get(date)
        const opened = yield* drawers.open(date, { openingAmount: 50_000 })
        yield* paidInCash(12_000)
        const category = yield* drawers.addCategory('비품')
        yield* drawers.recordExpense({ date, amount: 3_000, categoryId: category.id, idempotencyKey: 'e1' })
        const closed = yield* drawers.close(date, 58_000)
        const reopened = yield* drawers.reopen(date, '시재 다시 셈')
        const closedAgain = yield* drawers.close(date, 59_000)
        return { before, opened, closed, reopened, closedAgain }
      }),
      store,
    )
    expect(result.before).toMatchObject({
      status: 'NOT_OPENED',
      openingAmount: null,
      expectedClosing: null,
      version: 0,
    })
    expect(result.opened).toMatchObject({ status: 'OPEN', openingAmount: 50_000, expectedClosing: 50_000, version: 1 })
    expect(result.closed).toMatchObject({
      status: 'CLOSED',
      cashIn: 12_000,
      expenses: 3_000,
      expectedClosing: 59_000,
      closing: { countedAmount: 58_000, expectedClosing: 59_000, difference: -1_000 },
      reopened: null,
    })
    expect(result.closed.closing).not.toHaveProperty('ledger')
    expect(result.reopened).toMatchObject({
      status: 'REOPENED',
      reopened: { cause: 'MANUAL', reason: '시재 다시 셈', by: desk.access.userId },
    })
    expect(result.closedAgain).toMatchObject({ status: 'CLOSED', closing: { difference: 0 }, reopened: null })
  })

  it('reopens by itself when the cash of a closed day changes, and not for card payments', async () => {
    const result = await run(
      Effect.gen(function* () {
        const drawers = yield* CashDrawers
        const date = today()
        yield* drawers.open(date, { openingAmount: 0 })
        yield* drawers.close(date, 0)
        const { receipt } = yield* paidInCash(7_000)
        const changed = yield* drawers.get(date)
        const closed = yield* drawers.close(date, 7_000)
        // 같은 날 영수증을 취소하면 받지 않은 것이 되어 원장이 다시 바뀝니다
        yield* (yield* Receipts).void(receipt.id, '오수납')
        const voided = yield* drawers.get(date)
        return { changed, closed, voided }
      }),
      store,
    )
    expect(result.changed).toMatchObject({
      status: 'REOPENED',
      cashIn: 7_000,
      reopened: { cause: 'CHANGED_AFTER_CLOSE', reason: null, at: null, by: null },
    })
    expect(result.closed).toMatchObject({ status: 'CLOSED', closing: { difference: 0 } })
    expect(result.voided).toMatchObject({ status: 'REOPENED', cashIn: 0, cashRefunds: 0, expectedClosing: 0 })
  })

  it('carries over the counted amount of the last closed drawer only when there is one', async () => {
    const result = await run(
      Effect.gen(function* () {
        const drawers = yield* CashDrawers
        const date = today()
        const none = yield* failure(drawers.open(date, { carryOver: true }))
        const both = yield* failure(drawers.open(date, { openingAmount: 1, carryOver: true }))
        const neither = yield* failure(drawers.open(date, {}))
        yield* drawers.open('2020-01-01', { openingAmount: 10_000 })
        yield* drawers.close('2020-01-01', 12_340)
        const carried = yield* drawers.open(date, { carryOver: true })
        const again = yield* failure(drawers.open(date, { openingAmount: 0 }))
        // 앞 시재를 다시 열면 그 센 금액은 이어받지 않습니다
        yield* drawers.reopen('2020-01-01', '다시 셈')
        const stale = yield* failure(drawers.open('2020-01-02', { carryOver: true }))
        const future = yield* failure(drawers.open('2999-01-01', { openingAmount: 0 }))
        return { none, both, neither, carried, again, future, stale }
      }),
      store,
    )
    expect(result.none).toMatchObject({ code: 'CASH_DRAWER_CARRY_OVER_UNAVAILABLE' })
    expect(result.both).toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(result.neither).toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(result.carried).toMatchObject({ openingAmount: 12_340, carriedOver: true })
    expect(result.again).toMatchObject({
      code: 'CASH_DRAWER_TRANSITION_INVALID',
      currentStatus: 'OPEN',
      command: 'OPEN',
    })
    expect(result.future).toMatchObject({ code: 'CASH_DRAWER_DATE_IN_FUTURE' })
    expect(result.stale).toMatchObject({ code: 'CASH_DRAWER_CARRY_OVER_UNAVAILABLE' })
  })

  it('refuses commands that do not fit the status', async () => {
    const result = await run(
      Effect.gen(function* () {
        const drawers = yield* CashDrawers
        const date = today()
        const closeUnopened = yield* failure(drawers.close(date, 0))
        yield* drawers.open(date, { openingAmount: 0 })
        const reopenOpen = yield* failure(drawers.reopen(date, '사유'))
        yield* drawers.close(date, 0)
        const closeClosed = yield* failure(drawers.close(date, 0))
        return { closeUnopened, reopenOpen, closeClosed }
      }),
      store,
    )
    expect(result.closeUnopened).toMatchObject({ currentStatus: 'NOT_OPENED', command: 'CLOSE' })
    expect(result.reopenOpen).toMatchObject({ currentStatus: 'OPEN', command: 'REOPEN' })
    expect(result.closeClosed).toMatchObject({ currentStatus: 'CLOSED', command: 'CLOSE' })
  })

  it('records and removes expenses only while the drawer of the date is open', async () => {
    const result = await run(
      Effect.gen(function* () {
        const drawers = yield* CashDrawers
        const date = today()
        const category = yield* drawers.addCategory('식대')
        const input = { date, amount: 9_000, categoryId: category.id, memo: '점심' }
        const notOpen = yield* failure(drawers.recordExpense({ ...input, idempotencyKey: 'a' }))
        yield* drawers.open(date, { openingAmount: 20_000 })
        const unknown = yield* failure(
          drawers.recordExpense({
            ...input,
            categoryId: 'exc_01JBQ000000000000000000009' as Id<'expenseCategory'>,
            idempotencyKey: 'b',
          }),
        )
        const expense = yield* drawers.recordExpense({ ...input, idempotencyKey: 'c' })
        const replay = yield* drawers.recordExpense({ ...input, idempotencyKey: 'c' })
        // 항목을 지워도 기록한 지출은 이름을 남깁니다
        yield* drawers.removeCategory(category.id)
        const listed = yield* drawers.listExpenses({ from: date, to: date })
        const withExpense = yield* drawers.get(date)
        yield* drawers.close(date, 11_000)
        const removeClosed = yield* failure(drawers.removeExpense(expense.id))
        yield* drawers.reopen(date, '지출 취소')
        yield* drawers.removeExpense(expense.id)
        const removedAgain = yield* failure(drawers.removeExpense(expense.id))
        const after = yield* drawers.get(date)
        const listedAfter = yield* drawers.listExpenses({ from: date, to: date })
        return {
          notOpen,
          unknown,
          expense,
          replay,
          listed,
          withExpense,
          removeClosed,
          removedAgain,
          after,
          listedAfter,
        }
      }),
      store,
    )
    expect(result.notOpen).toMatchObject({ code: 'CASH_DRAWER_NOT_OPEN', currentStatus: 'NOT_OPENED' })
    expect(result.unknown).toMatchObject({ code: 'EXPENSE_CATEGORY_INVALID' })
    expect(result.replay).toEqual(result.expense)
    expect(result.listed).toEqual([result.expense])
    expect(result.listed[0]?.category.name).toBe('식대')
    expect(result.withExpense).toMatchObject({ expenses: 9_000, expectedClosing: 11_000 })
    expect(result.removeClosed).toMatchObject({ code: 'CASH_DRAWER_NOT_OPEN', currentStatus: 'CLOSED' })
    expect(result.removedAgain).toMatchObject({ code: 'EXPENSE_NOT_FOUND' })
    expect(result.after).toMatchObject({ status: 'REOPENED', expenses: 0, expectedClosing: 20_000 })
    expect(result.listedAfter).toEqual([])
  })

  it('keeps category names unique and lists expenses for at most 31 days', async () => {
    const result = await run(
      Effect.gen(function* () {
        const drawers = yield* CashDrawers
        yield* drawers.addCategory('비품')
        const taken = yield* failure(drawers.addCategory('비품'))
        yield* drawers.addCategory('식대')
        const categories = yield* drawers.listCategories()
        const missing = yield* failure(
          drawers.removeCategory('exc_01JBQ000000000000000000009' as Id<'expenseCategory'>),
        )
        const tooLong = yield* failure(drawers.listExpenses({ from: '2026-01-01', to: '2026-02-01' }))
        const reversed = yield* failure(drawers.listExpenses({ from: '2026-01-02', to: '2026-01-01' }))
        const month = yield* drawers.listExpenses({ from: '2026-01-01', to: '2026-01-31' })
        return { taken, categories: categories.map((each) => each.name), missing, tooLong, reversed, month }
      }),
      store,
    )
    expect(result.taken).toMatchObject({ code: 'EXPENSE_CATEGORY_NAME_TAKEN' })
    expect(result.categories).toEqual(['비품', '식대'])
    expect(result.missing).toMatchObject({ code: 'EXPENSE_CATEGORY_NOT_FOUND' })
    expect(result.tooLong).toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(result.reversed).toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(result.month).toEqual([])
  })
})
