import { Context, Effect, Layer, Option, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { toReceiptPayment } from './receipt-adjustments.ts'
import { byRecorded, type Payment, type Receipt, type ReceiptRecord } from './receipt.ts'

/** 목록의 다음 쪽 시작점입니다. 앞 쪽 마지막 행의 만든 시각과 ID입니다. */
export interface After {
  createdAt: string
  id: string
}

export interface ReceiptQuery {
  /** 수납한 날(병원 시간대)입니다. */
  date?: string
  patientId?: Id<'patient'>
  after: After | null
  limit: number
}

export interface PaymentQuery {
  status?: Payment['status']
  patientId?: Id<'patient'>
  after: After | null
  limit: number
}

/**
 * 한 번에 쓰는 영수증·결제 변경입니다. 바꾸는 행은 읽은 버전(`expectedVersion`)이 그대로일 때만 씁니다. 같은
 * 트랜잭션에서 읽고 판정한 뒤 쓰므로 어긋나면 결함입니다.
 */
export interface ReceiptChanges {
  insertReceipts?: ReadonlyArray<ReceiptRecord>
  updateReceipts?: ReadonlyArray<{ receipt: ReceiptRecord; expectedVersion: number }>
  insertPayments?: ReadonlyArray<Payment>
  updatePayments?: ReadonlyArray<{ payment: Payment; expectedVersion: number }>
  events?: ReadonlyArray<DomainEvent>
}

interface Store {
  receipts: Map<string, ReceiptRecord>
  payments: Map<string, Payment>
}

const isAfter = (row: { createdAt: string; id: string }, after: After | null) =>
  after === null || byRecorded(row, after) > 0

/**
 * 영수증과 결제 저장소입니다. 결제는 영수증 없이(`UNAPPLIED`) 먼저 남을 수 있어 따로 보관하고, 영수증을 읽을 때 그
 * 영수증의 결제를 받은 순서로 붙입니다.
 *
 * 쓰기는 `commit` 하나입니다. 수납·환불·취소·정정이 영수증과 결제 여러 행을 함께 바꾸기 때문입니다. 내원 하나에 유효한
 * 영수증은 하나이고, 둘째를 넣으려 하면 결함입니다(서비스가 먼저 막습니다).
 */
export class ReceiptRepository extends Context.Service<
  ReceiptRepository,
  {
    findById(tenantId: Id<'tenant'>, id: Id<'receipt'>): Effect.Effect<Option.Option<Receipt>>
    /** 내원의 영수증입니다. 만든 순서입니다. */
    listByVisit(tenantId: Id<'tenant'>, visitId: Id<'visit'>): Effect.Effect<ReadonlyArray<Receipt>>
    /** 영수증 목록입니다. 만든 시각, ID 순서로 `limit`개까지 줍니다. */
    list(tenantId: Id<'tenant'>, query: ReceiptQuery): Effect.Effect<ReadonlyArray<Receipt>>
    findPayment(tenantId: Id<'tenant'>, id: Id<'payment'>): Effect.Effect<Option.Option<Payment>>
    /** 병원의 결제 중 `ids`에 있는 것입니다. 없는 ID는 빠집니다. */
    listPayments(tenantId: Id<'tenant'>, ids: ReadonlyArray<Id<'payment'>>): Effect.Effect<ReadonlyArray<Payment>>
    /** 영수증의 결제 전체입니다. 받은 순서입니다. */
    paymentsOf(tenantId: Id<'tenant'>, receiptId: Id<'receipt'>): Effect.Effect<ReadonlyArray<Payment>>
    /** 결제 목록입니다. 받은 시각, ID 순서로 `limit`개까지 줍니다. */
    searchPayments(tenantId: Id<'tenant'>, query: PaymentQuery): Effect.Effect<ReadonlyArray<Payment>>
    /** 영수증·결제 변경과 이벤트를 한 번에 씁니다. */
    commit(changes: ReceiptChanges): Effect.Effect<void>
  }
>()('hemr/front-desk/ReceiptRepository') {
  /** 프로세스 메모리에 영수증과 결제를 보관합니다. 이벤트는 `Outbox`에 씁니다. */
  static readonly layerMemory = Layer.effect(
    ReceiptRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make<Store>({ receipts: new Map(), payments: new Map() })
      const outbox = yield* Outbox

      const withPayments = (receipt: ReceiptRecord, payments: Map<string, Payment>): Receipt => ({
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
                .sort(byRecorded)
                .map((each) => withPayments(each, all.payments)),
            ),
          ),
        list: (tenantId, query) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              [...all.receipts.values()]
                .filter(
                  (each) =>
                    each.tenantId === tenantId &&
                    (query.date === undefined || each.date === query.date) &&
                    (query.patientId === undefined || each.patientId === query.patientId) &&
                    isAfter(each, query.after),
                )
                .sort(byRecorded)
                .slice(0, query.limit)
                .map((each) => withPayments(each, all.payments)),
            ),
          ),
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
        paymentsOf: (tenantId, receiptId) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              [...all.payments.values()]
                .filter((each) => each.tenantId === tenantId && each.receiptId === receiptId)
                .sort(byRecorded),
            ),
          ),
        searchPayments: (tenantId, query) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              [...all.payments.values()]
                .filter(
                  (each) =>
                    each.tenantId === tenantId &&
                    (query.status === undefined || each.status === query.status) &&
                    (query.patientId === undefined || each.patientId === query.patientId) &&
                    isAfter(each, query.after),
                )
                .sort(byRecorded)
                .slice(0, query.limit),
            ),
          ),
        commit: (changes) =>
          Effect.gen(function* () {
            const conflict = yield* Ref.modify(store, (all): [string | null, Store] => {
              const receipts = new Map(all.receipts)
              const payments = new Map(all.payments)
              for (const { receipt, expectedVersion } of changes.updateReceipts ?? []) {
                const current = receipts.get(receipt.id)
                if (current?.tenantId !== receipt.tenantId || current.version !== expectedVersion) {
                  return [`receipt ${receipt.id} changed`, all]
                }
                receipts.set(receipt.id, receipt)
              }
              for (const receipt of changes.insertReceipts ?? []) {
                const taken =
                  receipts.has(receipt.id) ||
                  (receipt.status === 'ACTIVE' &&
                    [...receipts.values()].some(
                      (each) =>
                        each.tenantId === receipt.tenantId &&
                        each.visitId === receipt.visitId &&
                        each.status === 'ACTIVE',
                    ))
                if (taken) return [`receipt ${receipt.id} conflicts with an existing receipt`, all]
                receipts.set(receipt.id, receipt)
              }
              for (const { payment, expectedVersion } of changes.updatePayments ?? []) {
                const current = payments.get(payment.id)
                if (current?.tenantId !== payment.tenantId || current.version !== expectedVersion) {
                  return [`payment ${payment.id} changed`, all]
                }
                payments.set(payment.id, payment)
              }
              for (const payment of changes.insertPayments ?? []) {
                if (payments.has(payment.id)) return [`payment ${payment.id} already exists`, all]
                payments.set(payment.id, payment)
              }
              return [null, { receipts, payments }]
            })
            if (conflict !== null) return yield* Effect.die(new Error(conflict))
            yield* outbox.append(changes.events ?? [])
          }),
      })
    }),
  )

  /** SQL `receipts`·`payments` 테이블에 보관합니다. 변경과 이벤트를 한 트랜잭션에서 씁니다. */
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
        voided: string | null
        correctionOf: string | null
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
        refunds: string
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
        refunds: JSON.parse(row.refunds) as Payment['refunds'],
        recordedBy: row.recordedBy as Payment['recordedBy'],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        version: row.version,
      })

      const paymentColumns = sql`
        id, tenant_id AS tenantId, patient_id AS patientId, visit_id AS visitId, receipt_id AS receiptId, method,
        prepaid_kind AS prepaidKind, amount_taxable AS taxable, amount_tax_exempt AS taxExempt,
        processor_ref AS processorRef, status, refunds, recorded_by AS recordedBy, created_at AS createdAt,
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
        refunds: JSON.stringify(payment.refunds),
        recorded_by: payment.recordedBy,
        created_at: payment.createdAt,
        updated_at: payment.updatedAt,
        version: payment.version,
      })

      const receiptRow = (receipt: ReceiptRecord) => ({
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
        voided: receipt.voided === null ? null : JSON.stringify(receipt.voided),
        correction_of: receipt.correctionOf,
        created_at: receipt.createdAt,
        updated_at: receipt.updatedAt,
        version: receipt.version,
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
            voided: row.voided === null ? null : (JSON.parse(row.voided) as Receipt['voided']),
            correctionOf: row.correctionOf as Receipt['correctionOf'],
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            version: row.version,
          }))
        })

      const columns = sql`
        id, tenant_id AS tenantId, visit_id AS visitId, patient_id AS patientId, date, cashier_id AS cashierId, memo,
        encounter_ids AS encounterIds, quote_id AS quoteId, charges, settlement, flags, status, voided,
        correction_of AS correctionOf, created_at AS createdAt, updated_at AS updatedAt, version
      `

      const afterClause = (after: After | null) =>
        after === null
          ? sql`1 = 1`
          : sql`(created_at > ${after.createdAt} OR (created_at = ${after.createdAt} AND id > ${after.id}))`

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
        list: (tenantId, query) =>
          sql<Row>`
            SELECT ${columns} FROM receipts
            WHERE tenant_id = ${tenantId}
              AND ${query.date === undefined ? sql`1 = 1` : sql`date = ${query.date}`}
              AND ${query.patientId === undefined ? sql`1 = 1` : sql`patient_id = ${query.patientId}`}
              AND ${afterClause(query.after)}
            ORDER BY created_at, id LIMIT ${query.limit}
          `.pipe(Effect.flatMap(toReceipts), Effect.orDie),
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
        paymentsOf: (tenantId, receiptId) =>
          sql<PaymentRow>`
            SELECT ${paymentColumns} FROM payments WHERE tenant_id = ${tenantId} AND receipt_id = ${receiptId}
            ORDER BY created_at, id
          `.pipe(
            Effect.map((rows) => rows.map(toPayment)),
            Effect.orDie,
          ),
        searchPayments: (tenantId, query) =>
          sql<PaymentRow>`
            SELECT ${paymentColumns} FROM payments
            WHERE tenant_id = ${tenantId}
              AND ${query.status === undefined ? sql`1 = 1` : sql`status = ${query.status}`}
              AND ${query.patientId === undefined ? sql`1 = 1` : sql`patient_id = ${query.patientId}`}
              AND ${afterClause(query.after)}
            ORDER BY created_at, id LIMIT ${query.limit}
          `.pipe(
            Effect.map((rows) => rows.map(toPayment)),
            Effect.orDie,
          ),
        commit: (changes) =>
          Effect.gen(function* () {
            // 취소한 영수증을 먼저 써야 같은 내원의 새 유효 영수증(정정)이 부분 유일 인덱스에 걸리지 않습니다
            for (const { receipt, expectedVersion } of changes.updateReceipts ?? []) {
              const { id: _, tenant_id: __, ...row } = receiptRow(receipt)
              const updated = yield* sql<{ id: string }>`
                UPDATE receipts SET ${sql.update(row)}
                WHERE id = ${receipt.id} AND tenant_id = ${receipt.tenantId} AND version = ${expectedVersion}
                RETURNING id
              `
              if (updated.length !== 1) return yield* Effect.die(new Error(`receipt ${receipt.id} changed`))
            }
            for (const receipt of changes.insertReceipts ?? []) {
              yield* sql`INSERT INTO receipts ${sql.insert(receiptRow(receipt))}`
            }
            for (const { payment, expectedVersion } of changes.updatePayments ?? []) {
              const { id: _, tenant_id: __, ...row } = paymentRow(payment)
              const updated = yield* sql<{ id: string }>`
                UPDATE payments SET ${sql.update(row)}
                WHERE id = ${payment.id} AND tenant_id = ${payment.tenantId} AND version = ${expectedVersion}
                RETURNING id
              `
              if (updated.length !== 1) return yield* Effect.die(new Error(`payment ${payment.id} changed`))
            }
            for (const payment of changes.insertPayments ?? []) {
              yield* sql`INSERT INTO payments ${sql.insert(paymentRow(payment))}`
            }
            yield* outbox.append(changes.events ?? [])
          }).pipe(sql.withTransaction, Effect.orDie),
      })
    }),
  )
}
