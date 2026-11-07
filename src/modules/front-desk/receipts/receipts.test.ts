import { Effect, Exit, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { EncounterRepository } from '../../clinical/encounters/encounter-repository.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'
import { Patients } from '../../patients/patients.ts'
import { Visits } from '../visits/visits.ts'
import { Payments } from './payments.ts'
import { ReceiptRepository } from './receipt-repository.ts'
import { Receipts } from './receipts.ts'

const desk = testMember({ role: 'FRONT_DESK' })

type Services =
  Receipts | Payments | ReceiptRepository | Visits | Patients | EncounterRepository | Outbox | CurrentAccess

const run = <A, E>(program: Effect.Effect<A, E, Services>, store: 'memory' | 'sqlite') =>
  Effect.runPromise(
    program.pipe(
      Effect.provideService(CurrentAccess, desk.access),
      Effect.provide(
        Layer.merge(Receipts.layer, Payments.layer).pipe(
          Layer.provideMerge(Visits.layer),
          Layer.provideMerge(Patients.layer),
          Layer.provideMerge(desk.seed),
          Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
          Layer.provideMerge(TestPatientCrypto),
        ),
      ),
    ),
  )

const checkedIn = Effect.gen(function* () {
  const patient = yield* (yield* Patients).register({ name: '홍길동' })
  return yield* (yield* Visits).checkIn({ patientId: patient.id, coverage: 'SELF_PAY' })
})

describe.each(['memory', 'sqlite'] as const)('Receipts (%s)', (store) => {
  it('writes receipt.created and visit.status_changed with the checkout', async () => {
    const events = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const receipts = yield* Receipts
        const quote = yield* receipts.quote(visit.id, {})
        const { receipt } = yield* receipts.checkout(visit.id, { quoteId: quote.quoteId, idempotencyKey: 'k' })
        const pending = yield* (yield* Outbox).pending(100)
        return {
          receiptId: receipt.id,
          events: pending
            .map((row) => row.event)
            .filter((event) => event.type === 'receipt.created' || event.type === 'visit.status_changed'),
        }
      }),
      store,
    )
    expect(events.events.map((event) => [event.type, event.data])).toEqual([
      ['visit.status_changed', expect.objectContaining({ from: 'WAITING', to: 'COMPLETED' })],
      [
        'receipt.created',
        expect.objectContaining({ receiptId: events.receiptId, total: 0, result: 'PAID', acknowledged: [] }),
      ],
    ])
  })

  it('refuses an encounter whose coverage no longer matches the visit eligibility', async () => {
    const error = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const encounters = yield* EncounterRepository
        const encounterId = visit.encounterId as Id<'encounter'>
        const encounter = Option.getOrThrow(yield* encounters.findById(visit.tenantId, encounterId))
        yield* encounters.save(
          {
            ...encounter,
            coverage: 'NHIS',
            prescriptionLines: [
              {
                id: 'pl_01JBQ000000000000000000001' as Id<'prescriptionLine'>,
                kind: 'ACUPUNCTURE',
                feeCode: '40011',
                categoryCode: '33001001',
                name: '침술',
                dose: { perDay: 1, days: 1 },
                unitPrice: 4_210,
                amount: 4_210,
                prn: false,
              },
            ],
            version: encounter.version + 1,
          },
          { expectedVersion: encounter.version },
        )
        return yield* Effect.flip((yield* Receipts).quote(visit.id, {}))
      }),
      store,
    )
    expect(error).toMatchObject({ code: 'CHECKOUT_COVERAGE_UNSUPPORTED' })
  })

  it('quotes and checks out the insured copay of an NHIS visit from the patient age at the visit date', async () => {
    const result = await run(
      Effect.gen(function* () {
        const patient = yield* (yield* Patients).register({ name: '김노인', birthDate: '1950-01-01' })
        const visit = yield* (yield* Visits).checkIn({
          patientId: patient.id,
          coverage: 'NHIS',
          eligibility: { qualificationCode: '1', selectedInstitutionCodes: [] },
          identityVerified: true,
        })
        const encounters = yield* EncounterRepository
        const encounterId = visit.encounterId as Id<'encounter'>
        const encounter = Option.getOrThrow(yield* encounters.findById(visit.tenantId, encounterId))
        const line = (id: string, kind: 'CONSULTATION' | 'NONBENEFIT', feeCode: string | null, amount: number) => ({
          id: `pl_01JBQ00000000000000000000${id}` as Id<'prescriptionLine'>,
          kind,
          feeCode,
          categoryCode: '33001001',
          name: kind,
          dose: { perDay: 1, days: 1 },
          unitPrice: amount,
          amount,
          prn: false,
        })
        yield* encounters.save(
          {
            ...encounter,
            prescriptionLines: [line('1', 'CONSULTATION', '10200', 14_000), line('2', 'NONBENEFIT', null, 10_000)],
            version: encounter.version + 1,
          },
          { expectedVersion: encounter.version },
        )
        const receipts = yield* Receipts
        const quote = yield* receipts.quote(visit.id, {})
        const { receipt } = yield* receipts.checkout(visit.id, {
          quoteId: quote.quoteId,
          payments: [{ method: 'CASH', amount: { taxable: 0, taxExempt: 11_500 } }],
          idempotencyKey: 'k',
        })
        return { quote, receipt }
      }),
      store,
    )
    // 65세 이상, 급여 총액 15,000원 이하라 1,500원 정액입니다
    expect(result.quote.charges).toEqual({
      insuredCopay: 1_500,
      nonbenefit: { taxable: 0, taxExempt: 10_000 },
      total: 11_500,
    })
    expect(result.receipt.charges.insuredCopay).toBe(1_500)
    expect(result.receipt.settlement.result).toBe('PAID')
  })

  it('refuses an NHIS visit with insured lines when the patient has no birth date', async () => {
    const error = await run(
      Effect.gen(function* () {
        const patient = yield* (yield* Patients).register({ name: '무생일' })
        const visit = yield* (yield* Visits).checkIn({
          patientId: patient.id,
          coverage: 'NHIS',
          eligibility: { qualificationCode: '1', selectedInstitutionCodes: [] },
          identityVerified: true,
        })
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
                kind: 'CONSULTATION',
                feeCode: '10200',
                categoryCode: '33001001',
                name: '재진',
                dose: { perDay: 1, days: 1 },
                unitPrice: 12_000,
                amount: 12_000,
                prn: false,
              },
            ],
            version: encounter.version + 1,
          },
          { expectedVersion: encounter.version },
        )
        return yield* Effect.flip((yield* Receipts).quote(visit.id, {}))
      }),
      store,
    )
    expect(error).toMatchObject({ code: 'CHECKOUT_COVERAGE_UNSUPPORTED', encounterIds: [expect.any(String)] })
  })

  it('applies a recorded payment ahead of in-request payments and reads them back in that order', async () => {
    const result = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const payments = yield* Payments
        const receipts = yield* Receipts
        const card = yield* payments.record({
          patientId: visit.patientId,
          method: 'CARD',
          amount: { taxable: 0, taxExempt: 3_000 },
          processorRef: '1',
          idempotencyKey: 'p',
        })
        const options = {
          paymentIds: [card.id],
          payments: [
            { method: 'CASH' as const, amount: { taxable: 0, taxExempt: 1_000 } },
            { method: 'BANK_TRANSFER' as const, amount: { taxable: 0, taxExempt: 2_000 } },
            { method: 'CASH' as const, amount: { taxable: 0, taxExempt: 4_000 } },
          ],
        }
        const quote = yield* receipts.quote(visit.id, options)
        const { receipt } = yield* receipts.checkout(visit.id, {
          ...options,
          quoteId: quote.quoteId,
          idempotencyKey: 'k',
        })
        const repository = yield* ReceiptRepository
        const pending = yield* (yield* Outbox).pending(100)
        return {
          visitId: visit.id,
          card,
          receipt,
          stored: Option.getOrThrow(yield* repository.findById(visit.tenantId, receipt.id)),
          captured: Option.getOrThrow(yield* repository.findPayment(visit.tenantId, card.id)),
          events: pending
            .map((row) => row.event)
            .filter((event) => event.type === 'payment.recorded' || event.type === 'receipt.created'),
        }
      }),
      store,
    )
    // 미리 기록한 결제는 받은 시각 순서라 보통 앞이지만, 같은 밀리초면 ID 순입니다. 요청 안의 결제는 요청 순서입니다
    const amounts = result.receipt.payments
      .filter((each) => each.id !== result.card.id)
      .map((each) => [each.method, each.amount.taxExempt])
    expect(result.receipt.payments).toHaveLength(4)
    expect(amounts).toEqual([
      ['CASH', 1_000],
      ['BANK_TRANSFER', 2_000],
      ['CASH', 4_000],
    ])
    expect(result.stored.payments).toEqual(result.receipt.payments)
    // 내원 없이 기록한 결제는 적용한 수납의 내원을 받습니다
    expect(result.captured).toMatchObject({ status: 'CAPTURED', receiptId: result.receipt.id, visitId: result.visitId })
    expect(result.events.map((event) => [event.type, event.data])).toEqual([
      [
        'payment.recorded',
        {
          paymentId: result.card.id,
          patientId: result.card.patientId,
          visitId: null,
          method: 'CARD',
          amount: { taxable: 0, taxExempt: 3_000 },
        },
      ],
      ['receipt.created', expect.objectContaining({ paymentIds: result.receipt.payments.map((each) => each.id) })],
    ])
  })

  it('writes nothing when one change of a commit is stale', async () => {
    const result = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const receipts = yield* Receipts
        const quote = yield* receipts.quote(visit.id, {})
        const { receipt } = yield* receipts.checkout(visit.id, {
          quoteId: quote.quoteId,
          payments: [{ method: 'CASH', amount: { taxable: 0, taxExempt: 1 } }],
          acknowledge: ['OUTSTANDING'],
          idempotencyKey: 'k',
        })
        const repository = yield* ReceiptRepository
        const cash = Option.getOrThrow(yield* repository.findPayment(visit.tenantId, receipt.payments[0]!.id))
        const { payments: _, ...record } = receipt
        const other = {
          ...record,
          id: 'rcp_01JBQ000000000000000000077' as Id<'receipt'>,
          visitId: 'vis_01JBQ000000000000000000077' as Id<'visit'>,
        }
        const fresh = { ...cash, id: 'pay_01JBQ000000000000000000077' as Id<'payment'>, receiptId: other.id }
        const exit = yield* Effect.exit(
          repository.commit({
            updateReceipts: [{ receipt: { ...record, memo: '바뀜', version: 2 }, expectedVersion: 1 }],
            insertReceipts: [other],
            // 읽은 버전이 저장된 버전과 달라 전체가 취소됩니다
            updatePayments: [{ payment: { ...cash, status: 'VOIDED', version: 3 }, expectedVersion: 2 }],
            insertPayments: [fresh],
          }),
        )
        return {
          exit,
          receipt: Option.getOrThrow(yield* repository.findById(visit.tenantId, receipt.id)),
          other: yield* repository.findById(visit.tenantId, other.id),
          fresh: yield* repository.findPayment(visit.tenantId, fresh.id),
          cash: Option.getOrThrow(yield* repository.findPayment(visit.tenantId, cash.id)),
        }
      }),
      store,
    )
    expect(Exit.isFailure(result.exit)).toBe(true)
    expect(result.receipt).toMatchObject({ memo: '', version: 1 })
    expect(result.other).toEqual(Option.none())
    expect(result.fresh).toEqual(Option.none())
    expect(result.cash).toMatchObject({ status: 'CAPTURED', version: 1 })
  })
})
