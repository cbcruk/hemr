import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteClient, SqliteMigrator } from '@effect/sql-sqlite-node'
import { Effect, Layer } from 'effect'
import { SqlClient } from 'effect/sql'
import { describe, expect, it } from 'vitest'
import { migrations, sqliteLayer } from './migrations.ts'

/** `last`까지만 적용한 SQLite 파일입니다. 이미 배포한 DB를 흉내 냅니다. */
const upTo = (filename: string, last: keyof typeof migrations) => {
  const keys = Object.keys(migrations)
  const applied = Object.fromEntries(
    keys.slice(0, keys.indexOf(last) + 1).map((key) => [key, migrations[key as keyof typeof migrations]]),
  )
  return SqliteMigrator.layer({ loader: SqliteMigrator.fromRecord(applied) }).pipe(
    Layer.provideMerge(SqliteClient.layer({ filename })),
  )
}

describe('migrations', () => {
  it('0013 moves receipt payments into the payments table', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hemr-'))
    const filename = join(dir, 'hemr.sqlite')
    try {
      await Effect.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`
            INSERT INTO receipts ${sql.insert({
              id: 'rcp_01JBQ000000000000000000001',
              tenant_id: 'ten_01JBQ000000000000000000001',
              visit_id: 'vis_01JBQ000000000000000000001',
              patient_id: 'pat_01JBQ000000000000000000001',
              date: '2026-11-06',
              cashier_id: 'usr_01JBQ000000000000000000001',
              memo: '',
              encounter_ids: '[]',
              quote_id: 'qt_01JBQ000000000000000000001',
              charges: '{}',
              payments: JSON.stringify([
                {
                  id: 'pay_01JBQ000000000000000000001',
                  method: 'CASH',
                  prepaidKind: null,
                  amount: { taxable: 0, taxExempt: 7_000 },
                  status: 'CAPTURED',
                },
              ]),
              settlement: '{}',
              flags: '{}',
              status: 'ACTIVE',
              created_at: '2026-11-06T01:00:00.000Z',
              updated_at: '2026-11-06T01:00:00.000Z',
              version: 1,
            })}
          `
        }).pipe(Effect.provide(upTo(filename, '0012_receipts'))),
      )

      const after = await Effect.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          return {
            payments: yield* sql`SELECT * FROM payments`,
            columns: yield* sql<{ name: string }>`SELECT name FROM pragma_table_info('receipts')`,
          }
        }).pipe(Effect.provide(sqliteLayer(filename))),
      )

      expect(after.payments).toEqual([
        {
          id: 'pay_01JBQ000000000000000000001',
          tenant_id: 'ten_01JBQ000000000000000000001',
          patient_id: 'pat_01JBQ000000000000000000001',
          visit_id: 'vis_01JBQ000000000000000000001',
          receipt_id: 'rcp_01JBQ000000000000000000001',
          method: 'CASH',
          prepaid_kind: null,
          amount_taxable: 0,
          amount_tax_exempt: 7_000,
          processor_ref: null,
          status: 'CAPTURED',
          recorded_by: 'usr_01JBQ000000000000000000001',
          created_at: '2026-11-06T01:00:00.000Z',
          updated_at: '2026-11-06T01:00:00.000Z',
          version: 1,
        },
      ])
      expect(after.columns.map((each) => each.name)).not.toContain('payments')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
