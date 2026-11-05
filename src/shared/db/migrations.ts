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
    // seq는 outbox에 tenant_id가 붙기 전까지 전체에서 단조 증가합니다. AUTOINCREMENT라 지운 번호를 다시 쓰지 않습니다
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
  '0002_identity': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // products·features는 JSON 배열 문자열입니다
    yield* sql`
      CREATE TABLE tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        hira_institution_code TEXT
          CHECK (hira_institution_code IS NULL OR hira_institution_code GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
        timezone TEXT NOT NULL,
        products TEXT NOT NULL CHECK (json_valid(products)),
        features TEXT NOT NULL CHECK (json_valid(features))
      ) STRICT
    `
    yield* sql`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        login_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        phone TEXT,
        license_number TEXT,
        license_type TEXT CHECK (license_type IN ('KOREAN_MEDICINE_DOCTOR', 'PHARMACIST'))
      ) STRICT
    `
    yield* sql`
      CREATE TABLE memberships (
        tenant_id TEXT NOT NULL REFERENCES tenants (id),
        user_id TEXT NOT NULL REFERENCES users (id),
        role TEXT NOT NULL
          CHECK (role IN ('OWNER_DOCTOR', 'ASSOCIATE_DOCTOR', 'MANAGER', 'FRONT_DESK', 'THERAPIST')),
        employment_type TEXT,
        joined_on TEXT NOT NULL CHECK (joined_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DEACTIVATED')),
        deactivated_from TEXT
          CHECK (deactivated_from IS NULL OR deactivated_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        scope TEXT NOT NULL CHECK (scope IN ('ALL', 'OWN')),
        PRIMARY KEY (tenant_id, user_id),
        -- 진료의는 근무형태가 있어야 청구를 보낼 수 있습니다
        CHECK (role NOT IN ('OWNER_DOCTOR', 'ASSOCIATE_DOCTOR') OR employment_type IS NOT NULL)
      ) STRICT
    `
    yield* sql`CREATE INDEX memberships_user ON memberships (user_id)`
    yield* sql`
      CREATE TABLE permission_grants (
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        permission TEXT NOT NULL,
        effect TEXT NOT NULL CHECK (effect IN ('GRANT', 'REVOKE')),
        PRIMARY KEY (tenant_id, user_id, permission),
        FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE
      ) STRICT
    `
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
