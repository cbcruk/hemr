import { Effect, Layer } from 'effect'
import { SqlClient } from 'effect/sql'
import { SqliteClient, SqliteMigrator } from '@effect/sql-sqlite-node'

/**
 * SQLite 스키마 마이그레이션입니다 (D9). 키는 `{번호}_{이름}`이고 번호 순서대로 한 번씩 적용합니다. 적용한 번호는
 * `effect_sql_migrations` 테이블에 남습니다. 이미 배포한 마이그레이션은 고치지 않고 새 번호를 더합니다.
 *
 * 쿼리는 공통 SQL로 쓰고, 타입을 엄격히 검사하려고 테이블만 SQLite `STRICT`로 만듭니다. 금액은 정수(원), 시각은
 * UTC ISO 8601 문자열, 불리언은 0/1입니다.
 */
export const migrations = {
  '0001_visits_and_outbox': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`
      CREATE TABLE visits (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL
          CHECK (status IN ('WAITING', 'IN_TREATMENT', 'AWAITING_PAYMENT', 'COMPLETED', 'CANCELED')),
        status_changed_at TEXT NOT NULL,
        status_reason TEXT,
        has_clinical_data INTEGER NOT NULL CHECK (has_clinical_data IN (0, 1)),
        version INTEGER NOT NULL CHECK (version >= 1)
      ) STRICT
    `
    // seq는 테넌트가 생기기 전까지 전체에서 단조 증가합니다. AUTOINCREMENT라 지운 번호를 다시 쓰지 않습니다
    yield* sql`
      CREATE TABLE outbox (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        time TEXT NOT NULL,
        subject TEXT NOT NULL,
        tenant_id TEXT,
        actor TEXT,
        data TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        last_error TEXT,
        published_at TEXT
      ) STRICT
    `
    yield* sql`CREATE INDEX outbox_pending ON outbox (seq) WHERE published_at IS NULL`
  }),
}

/** 마이그레이션을 적용하는 Layer입니다. 앱 Layer보다 먼저 만들어집니다. */
export const MigrationsLive = SqliteMigrator.layer({ loader: SqliteMigrator.fromRecord(migrations) })

/**
 * 파일(또는 `:memory:`) SQLite에 마이그레이션까지 적용한 `SqlClient`입니다. 테스트는 `:memory:`로 매번 빈 DB를
 * 만듭니다.
 */
export const sqliteLayer = (filename: string) =>
  MigrationsLive.pipe(Layer.provideMerge(SqliteClient.layer({ filename })))
