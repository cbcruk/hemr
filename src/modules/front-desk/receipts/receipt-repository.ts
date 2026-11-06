import { Context, Effect, Layer, Option, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { byRecorded, type Payment, type Receipt, type ReceiptPayment } from './receipt.ts'

/** 영수증의 결제로 보이는 필드입니다. */
const toReceiptPayment = (payment: Payment): ReceiptPayment => ({
  id: payment.id,
  method: payment.method,
  prepaidKind: payment.prepaidKind,
  amount: payment.amount,
  processorRef: payment.processorRef,
  status: 'CAPTURED',
})

/**
 * 영수증과 결제 저장소입니다. 결제는 영수증 없이(`UNAPPLIED`) 먼저 남을 수 있어 따로 보관하고, 영수증을 읽을 때 그
 * 영수증에 적용한 결제를 붙입니다.
 *
 * 영수증은 서버가 만든 ID로 넣기만 하므로 버전 비교가 없습니다. 내원 하나에 유효한 영수증은 하나이고, 둘째를 넣으려
 * 하면 결함입니다(수납이 내원 전이로 먼저 막습니다). 적용할 결제가 이미 적용됐어도 결함입니다(수납이 같은
 * 트랜잭션에서 `UNAPPLIED`를 확인합니다).
 */
export class ReceiptRepository extends Context.Service<
  ReceiptRepository,
  {
    findById(tenantId: Id<'tenant'>, id: Id<'receipt'>): Effect.Effect<Option.Option<Receipt>>
    /** 내원의 영수증입니다. 만든 순서입니다. */
    listByVisit(tenantId: Id<'tenant'>, visitId: Id<'visit'>): Effect.Effect<ReadonlyArray<Receipt>>
    /**
     * 영수증과 그 결제, 이벤트를 씁니다. `receipt.payments` 중 `applied`에 있는 결제는 미리 기록한 `UNAPPLIED` 결제를
     * 이 영수증에 적용(`CAPTURED`)하고, 나머지는 새 결제로 넣습니다. 내원 없이 기록한 결제는 적용할 때 영수증의
     * 내원을 받습니다.
     */
    insert(
      receipt: Receipt,
      events?: ReadonlyArray<DomainEvent>,
      applied?: ReadonlyArray<Id<'payment'>>,
    ): Effect.Effect<void>
    findPayment(tenantId: Id<'tenant'>, id: Id<'payment'>): Effect.Effect<Option.Option<Payment>>
    /** 병원의 결제 중 `ids`에 있는 것입니다. 없는 ID는 빠집니다. */
    listPayments(tenantId: Id<'tenant'>, ids: ReadonlyArray<Id<'payment'>>): Effect.Effect<ReadonlyArray<Payment>>
    /** 영수증 없이 결제를 남깁니다(`UNAPPLIED`). */
    recordPayment(payment: Payment, events?: ReadonlyArray<DomainEvent>): Effect.Effect<void>
  }
>()('hemr/front-desk/ReceiptRepository') {
  /** 프로세스 메모리에 영수증과 결제를 보관합니다. 이벤트는 `Outbox`에 씁니다. */
  static readonly layerMemory = Layer.effect(
    ReceiptRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make({
        receipts: new Map<string, Omit<Receipt, 'payments'>>(),
        payments: new Map<string, Payment>(),
      })
      const outbox = yield* Outbox

      const withPayments = (receipt: Omit<Receipt, 'payments'>, payments: Map<string, Payment>): Receipt => ({
        ...receipt,
        payments: [...payments.values()]
          .filter((each) => each.receiptId === receipt.id)
          .sort(byRecorded)
          .map(toReceiptPayment),
      })

      return ReceiptRepository.of({
        findById: (tenantId, id) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              Option.map(
                Option.filter(Option.fromNullishOr(all.receipts.get(id)), (each) => each.tenantId === tenantId),
                (each) => withPayments(each, all.payments),
              ),
            ),
          ),
        listByVisit: (tenantId, visitId) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              [...all.receipts.values()]
                .filter((each) => each.tenantId === tenantId && each.visitId === visitId)
                .map((each) => withPayments(each, all.payments)),
            ),
          ),
        insert: (receipt, events = [], applied = []) =>
          Effect.gen(function* () {
            const conflict = yield* Ref.modify(store, (all) => {
              const taken =
                all.receipts.has(receipt.id) ||
                [...all.receipts.values()].some(
                  (each) =>
                    each.tenantId === receipt.tenantId && each.visitId === receipt.visitId && each.status === 'ACTIVE',
                )
              const appliedIds = new Set<string>(applied)
              const unapplied = applied.every((id) => {
                const payment = all.payments.get(id)
                return payment?.tenantId === receipt.tenantId && payment.status === 'UNAPPLIED'
              })
              const fresh = receipt.payments.filter((each) => !appliedIds.has(each.id))
              if (taken || !unapplied || fresh.some((each) => all.payments.has(each.id))) return [true, all]

              const { payments: _, ...row } = receipt
              const payments = new Map(all.payments)
              for (const id of appliedIds) {
                const payment = payments.get(id)!
                payments.set(id, {
                  ...payment,
                  visitId: payment.visitId ?? receipt.visitId,
                  receiptId: receipt.id,
                  status: 'CAPTURED',
                  updatedAt: receipt.createdAt,
                  version: payment.version + 1,
                })
              }
              for (const each of fresh) payments.set(each.id, newPayment(receipt, each))
              return [false, { receipts: new Map(all.receipts).set(receipt.id, row), payments }]
            })
            if (conflict)
              return yield* Effect.die(new Error(`receipt ${receipt.id} conflicts with an existing receipt or payment`))
            yield* outbox.append(events)
          }),
        findPayment: (tenantId, id) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              Option.filter(Option.fromNullishOr(all.payments.get(id)), (each) => each.tenantId === tenantId),
            ),
          ),
        listPayments: (tenantId, ids) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              ids.flatMap((id) => {
                const payment = all.payments.get(id)
                return payment?.tenantId === tenantId ? [payment] : []
              }),
            ),
          ),
        recordPayment: (payment, events = []) =>
          Effect.gen(function* () {
            const conflict = yield* Ref.modify(store, (all) =>
              all.payments.has(payment.id)
                ? [true, all]
                : [false, { ...all, payments: new Map(all.payments).set(payment.id, payment) }],
            )
            if (conflict) return yield* Effect.die(new Error(`payment ${payment.id} already exists`))
            yield* outbox.append(events)
          }),
      })
    }),
  )

  /** SQL `receipts`·`payments` 테이블에 보관합니다. 영수증·결제와 이벤트를 한 트랜잭션에서 씁니다. */
  static readonly layerSql = Layer.effect(
    ReceiptRepository,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const outbox = yield* Outbox

      interface Row {
        id: string
        tenantId: string
        visitId: string
        patientId: string
        date: string
        cashierId: string
        memo: string
        encounterIds: string
        quoteId: string
        charges: string
        settlement: string
        flags: string
        status: Receipt['status']
        createdAt: string
        updatedAt: string
        version: number
      }

      interface PaymentRow {
        id: string
        tenantId: string
        patientId: string
        visitId: string | null
        receiptId: string | null
        method: Payment['method']
        prepaidKind: Payment['prepaidKind']
        taxable: number
        taxExempt: number
        processorRef: string | null
        status: Payment['status']
        recordedBy: string
        createdAt: string
        updatedAt: string
        version: number
      }

      const toPayment = (row: PaymentRow): Payment => ({
        id: row.id as Payment['id'],
        tenantId: row.tenantId as Payment['tenantId'],
        patientId: row.patientId as Payment['patientId'],
        visitId: row.visitId as Payment['visitId'],
        receiptId: row.receiptId as Payment['receiptId'],
        method: row.method,
        prepaidKind: row.prepaidKind,
        amount: { taxable: row.taxable, taxExempt: row.taxExempt },
        processorRef: row.processorRef,
        status: row.status,
        recordedBy: row.recordedBy as Payment['recordedBy'],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        version: row.version,
      })

      const paymentColumns = sql`
        id, tenant_id AS tenantId, patient_id AS patientId, visit_id AS visitId, receipt_id AS receiptId, method,
        prepaid_kind AS prepaidKind, amount_taxable AS taxable, amount_tax_exempt AS taxExempt,
        processor_ref AS processorRef, status, recorded_by AS recordedBy, created_at AS createdAt,
        updated_at AS updatedAt, version
      `

      const paymentRow = (payment: Payment) => ({
        id: payment.id,
        tenant_id: payment.tenantId,
        patient_id: payment.patientId,
        visit_id: payment.visitId,
        receipt_id: payment.receiptId,
        method: payment.method,
        prepaid_kind: payment.prepaidKind,
        amount_taxable: payment.amount.taxable,
        amount_tax_exempt: payment.amount.taxExempt,
        processor_ref: payment.processorRef,
        status: payment.status,
        recorded_by: payment.recordedBy,
        created_at: payment.createdAt,
        updated_at: payment.updatedAt,
        version: payment.version,
      })

      /** 영수증 행에 그 영수증의 결제를 붙입니다. */
      const toReceipts = (rows: ReadonlyArray<Row>) =>
        Effect.gen(function* () {
          if (rows.length === 0) return []
          const payments = yield* sql<PaymentRow>`
            SELECT ${paymentColumns} FROM payments
            WHERE tenant_id = ${rows[0]!.tenantId} AND ${sql.in(
              'receipt_id',
              rows.map((row) => row.id),
            )}
            ORDER BY created_at, id
          `
          return rows.map((row): Receipt => ({
            id: row.id as Receipt['id'],
            tenantId: row.tenantId as Receipt['tenantId'],
            visitId: row.visitId as Receipt['visitId'],
            patientId: row.patientId as Receipt['patientId'],
            date: row.date,
            cashierId: row.cashierId as Receipt['cashierId'],
            memo: row.memo,
            encounterIds: JSON.parse(row.encounterIds) as Receipt['encounterIds'],
            quoteId: row.quoteId as Receipt['quoteId'],
            charges: JSON.parse(row.charges) as Receipt['charges'],
            payments: payments
              .filter((each) => each.receiptId === row.id)
              .map((each) => toReceiptPayment(toPayment(each))),
            settlement: JSON.parse(row.settlement) as Receipt['settlement'],
            flags: JSON.parse(row.flags) as Receipt['flags'],
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            version: row.version,
          }))
        })

      const columns = sql`
        id, tenant_id AS tenantId, visit_id AS visitId, patient_id AS patientId, date, cashier_id AS cashierId, memo,
        encounter_ids AS encounterIds, quote_id AS quoteId, charges, settlement, flags, status,
        created_at AS createdAt, updated_at AS updatedAt, version
      `

      return ReceiptRepository.of({
        findById: (tenantId, id) =>
          sql<Row>`SELECT ${columns} FROM receipts WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
            Effect.flatMap(toReceipts),
            Effect.map((receipts) => Option.fromNullishOr(receipts[0])),
            Effect.orDie,
          ),
        listByVisit: (tenantId, visitId) =>
          sql<Row>`
            SELECT ${columns} FROM receipts WHERE tenant_id = ${tenantId} AND visit_id = ${visitId}
            ORDER BY created_at, id
          `.pipe(Effect.flatMap(toReceipts), Effect.orDie),
        insert: (receipt, events = [], applied = []) =>
          Effect.gen(function* () {
            yield* sql`
              INSERT INTO receipts ${sql.insert({
                id: receipt.id,
                tenant_id: receipt.tenantId,
                visit_id: receipt.visitId,
                patient_id: receipt.patientId,
                date: receipt.date,
                cashier_id: receipt.cashierId,
                memo: receipt.memo,
                encounter_ids: JSON.stringify(receipt.encounterIds),
                quote_id: receipt.quoteId,
                charges: JSON.stringify(receipt.charges),
                settlement: JSON.stringify(receipt.settlement),
                flags: JSON.stringify(receipt.flags),
                status: receipt.status,
                created_at: receipt.createdAt,
                updated_at: receipt.updatedAt,
                version: receipt.version,
              })}
            `
            const appliedIds = new Set<string>(applied)
            if (appliedIds.size > 0) {
              const updated = yield* sql<{ id: string }>`
                UPDATE payments SET receipt_id = ${receipt.id}, visit_id = COALESCE(visit_id, ${receipt.visitId}),
                  status = 'CAPTURED', updated_at = ${receipt.createdAt}, version = version + 1
                WHERE tenant_id = ${receipt.tenantId} AND status = 'UNAPPLIED' AND ${sql.in('id', [...appliedIds])}
                RETURNING id
              `
              if (updated.length !== appliedIds.size) {
                return yield* Effect.die(new Error(`receipt ${receipt.id} applies a payment that is not unapplied`))
              }
            }
            const fresh = receipt.payments.filter((each) => !appliedIds.has(each.id))
            for (const each of fresh) {
              yield* sql`INSERT INTO payments ${sql.insert(paymentRow(newPayment(receipt, each)))}`
            }
            yield* outbox.append(events)
          }).pipe(sql.withTransaction, Effect.orDie),
        findPayment: (tenantId, id) =>
          sql<PaymentRow>`SELECT ${paymentColumns} FROM payments WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toPayment)),
            Effect.orDie,
          ),
        listPayments: (tenantId, ids) =>
          ids.length === 0
            ? Effect.succeed([])
            : sql<PaymentRow>`
                SELECT ${paymentColumns} FROM payments WHERE tenant_id = ${tenantId} AND ${sql.in('id', ids)}
              `.pipe(
                Effect.map((rows) => {
                  const byId = new Map(rows.map((row) => [row.id, toPayment(row)]))
                  return ids.flatMap((id) => byId.get(id) ?? [])
                }),
                Effect.orDie,
              ),
        recordPayment: (payment, events = []) =>
          Effect.gen(function* () {
            yield* sql`INSERT INTO payments ${sql.insert(paymentRow(payment))}`
            yield* outbox.append(events)
          }).pipe(sql.withTransaction, Effect.orDie),
      })
    }),
  )
}

/** 수납 요청 안에서 받은 결제입니다. 영수증의 환자·내원·수납자·시각으로 처음부터 `CAPTURED`입니다. */
function newPayment(receipt: Receipt, payment: ReceiptPayment): Payment {
  return {
    id: payment.id,
    tenantId: receipt.tenantId,
    patientId: receipt.patientId,
    visitId: receipt.visitId,
    receiptId: receipt.id,
    method: payment.method,
    prepaidKind: payment.prepaidKind,
    amount: payment.amount,
    processorRef: payment.processorRef,
    status: 'CAPTURED',
    recordedBy: receipt.cashierId,
    createdAt: receipt.createdAt,
    updatedAt: receipt.createdAt,
    version: 1,
  }
}
