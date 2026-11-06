import { Context, Effect, Layer, Option, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { Receipt } from './receipt.ts'

/**
 * 영수증 저장소입니다. 새 영수증과 그 이벤트를 한 번에 씁니다. 영수증은 서버가 만든 ID로 넣기만 하므로 버전 비교가
 * 없습니다. 내원 하나에 유효한 영수증은 하나이고, 둘째를 넣으려 하면 결함입니다(수납이 내원 전이로 먼저 막습니다).
 */
export class ReceiptRepository extends Context.Service<
  ReceiptRepository,
  {
    findById(tenantId: Id<'tenant'>, id: Id<'receipt'>): Effect.Effect<Option.Option<Receipt>>
    /** 내원의 영수증입니다. 만든 순서입니다. */
    listByVisit(tenantId: Id<'tenant'>, visitId: Id<'visit'>): Effect.Effect<ReadonlyArray<Receipt>>
    insert(receipt: Receipt, events?: ReadonlyArray<DomainEvent>): Effect.Effect<void>
  }
>()('hemr/front-desk/ReceiptRepository') {
  /** 프로세스 메모리에 영수증을 보관합니다. 이벤트는 `Outbox`에 씁니다. */
  static readonly layerMemory = Layer.effect(
    ReceiptRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<string, Receipt>())
      const outbox = yield* Outbox
      return ReceiptRepository.of({
        findById: (tenantId, id) =>
          Ref.get(store).pipe(
            Effect.map((all) => Option.filter(Option.fromNullishOr(all.get(id)), (each) => each.tenantId === tenantId)),
          ),
        listByVisit: (tenantId, visitId) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              [...all.values()].filter((each) => each.tenantId === tenantId && each.visitId === visitId),
            ),
          ),
        insert: (receipt, events = []) =>
          Effect.gen(function* () {
            const conflict = yield* Ref.modify(store, (all) => {
              const taken =
                all.has(receipt.id) ||
                [...all.values()].some(
                  (each) =>
                    each.tenantId === receipt.tenantId && each.visitId === receipt.visitId && each.status === 'ACTIVE',
                )
              return taken ? [true, all] : [false, new Map(all).set(receipt.id, receipt)]
            })
            if (conflict)
              return yield* Effect.die(new Error(`receipt ${receipt.id} conflicts with an existing receipt`))
            yield* outbox.append(events)
          }),
      })
    }),
  )

  /** SQL `receipts` 테이블에 보관합니다. 영수증과 이벤트를 한 트랜잭션에서 씁니다. */
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
        payments: string
        settlement: string
        flags: string
        status: Receipt['status']
        createdAt: string
        updatedAt: string
        version: number
      }

      const toReceipt = (row: Row): Receipt => ({
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
        payments: JSON.parse(row.payments) as Receipt['payments'],
        settlement: JSON.parse(row.settlement) as Receipt['settlement'],
        flags: JSON.parse(row.flags) as Receipt['flags'],
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        version: row.version,
      })

      const columns = sql`
        id, tenant_id AS tenantId, visit_id AS visitId, patient_id AS patientId, date, cashier_id AS cashierId, memo,
        encounter_ids AS encounterIds, quote_id AS quoteId, charges, payments, settlement, flags, status,
        created_at AS createdAt, updated_at AS updatedAt, version
      `

      return ReceiptRepository.of({
        findById: (tenantId, id) =>
          sql<Row>`SELECT ${columns} FROM receipts WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toReceipt)),
            Effect.orDie,
          ),
        listByVisit: (tenantId, visitId) =>
          sql<Row>`
            SELECT ${columns} FROM receipts WHERE tenant_id = ${tenantId} AND visit_id = ${visitId}
            ORDER BY created_at, id
          `.pipe(
            Effect.map((rows) => rows.map(toReceipt)),
            Effect.orDie,
          ),
        insert: (receipt, events = []) =>
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
                payments: JSON.stringify(receipt.payments),
                settlement: JSON.stringify(receipt.settlement),
                flags: JSON.stringify(receipt.flags),
                status: receipt.status,
                created_at: receipt.createdAt,
                updated_at: receipt.updatedAt,
                version: receipt.version,
              })}
            `
            yield* outbox.append(events)
          }).pipe(sql.withTransaction, Effect.orDie),
      })
    }),
  )
}
