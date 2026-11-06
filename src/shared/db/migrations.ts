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
  '0003_auth': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`
      CREATE TABLE credentials (
        user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        password_hash TEXT NOT NULL,
        failed_attempts INTEGER NOT NULL CHECK (failed_attempts >= 0),
        locked_at TEXT
      ) STRICT
    `
    yield* sql`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        tenant_id TEXT REFERENCES tenants (id),
        created_at TEXT NOT NULL,
        revoked_at TEXT
      ) STRICT
    `
    yield* sql`CREATE INDEX sessions_user ON sessions (user_id)`
    // 토큰 원문은 두지 않고 SHA-256 값만 둡니다. 쓴 토큰도 재사용 감지를 위해 남깁니다
    yield* sql`
      CREATE TABLE refresh_tokens (
        token_hash TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        used_at TEXT
      ) STRICT
    `
    yield* sql`CREATE INDEX refresh_tokens_session ON refresh_tokens (session_id)`
    // 감사 로그는 사용자·세션을 지워도 남아야 하므로 외래 키를 두지 않습니다
    yield* sql`
      CREATE TABLE security_events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        time TEXT NOT NULL,
        login_id TEXT,
        user_id TEXT,
        tenant_id TEXT,
        session_id TEXT,
        detail TEXT
      ) STRICT
    `
  }),
  '0004_visit_tenant': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // SQLite는 NOT NULL 열을 기본값 없이 더할 수 없어 테이블을 새로 만듭니다. 접수 엔드포인트가 생기기 전이라 있는
    // 내원은 병원이 없는 개발용 샘플뿐이므로 옮기지 않습니다. 개발 서버는 뜰 때 샘플을 다시 넣습니다. 그 내원의 이전
    // outbox 이벤트는 병원 없이 남습니다. 실제 데이터가 생긴 뒤라면 이렇게 지우지 않고 옮겨야 합니다
    yield* sql`DROP TABLE visits`
    // 병원은 Identity 모듈의 테이블이라 외래 키를 걸지 않습니다. 모듈 사이는 ID로만 이어집니다
    yield* sql`
      CREATE TABLE visits (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
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
    yield* sql`CREATE INDEX visits_tenant_date ON visits (tenant_id, date)`
  }),
  '0005_patients': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // 주민등록번호는 암호문(rrn_sealed), 병원별 HMAC 색인(rrn_index), 가린 번호(rrn_masked)로만 둡니다. 원문 열은 없습니다.
    // chart_seq는 숫자 차트번호의 값으로 자동 채번에 씁니다. name_initials·name_folded·phone_digits는 검색용 파생 열입니다
    yield* sql`
      CREATE TABLE patients (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        chart_number TEXT NOT NULL,
        chart_seq INTEGER,
        name TEXT NOT NULL,
        name_initials TEXT NOT NULL,
        name_folded TEXT NOT NULL,
        rrn_sealed TEXT,
        rrn_index TEXT,
        rrn_masked TEXT,
        birth_date TEXT,
        is_lunar_birthday INTEGER NOT NULL CHECK (is_lunar_birthday IN (0, 1)),
        sex TEXT CHECK (sex IS NULL OR sex IN ('MALE', 'FEMALE')),
        contacts TEXT NOT NULL CHECK (json_valid(contacts)),
        phone_digits TEXT NOT NULL,
        addresses TEXT NOT NULL CHECK (json_valid(addresses)),
        notes TEXT,
        first_visit_date TEXT,
        status TEXT NOT NULL CHECK (status IN ('ACTIVE')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version >= 1),
        CHECK ((rrn_sealed IS NULL) = (rrn_index IS NULL) AND (rrn_index IS NULL) = (rrn_masked IS NULL))
      ) STRICT
    `
    yield* sql`CREATE UNIQUE INDEX patients_chart_number ON patients (tenant_id, chart_number)`
    yield* sql`CREATE UNIQUE INDEX patients_rrn_index ON patients (tenant_id, rrn_index) WHERE rrn_index IS NOT NULL`
    yield* sql`CREATE INDEX patients_name ON patients (tenant_id, name, id)`
    yield* sql`CREATE INDEX patients_chart_seq ON patients (tenant_id, chart_seq)`
    yield* sql`
      CREATE TABLE patient_consents (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        patient_id TEXT NOT NULL REFERENCES patients (id),
        purpose TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('GRANTED', 'DENIED', 'UNDECIDED', 'WITHDRAWN')),
        source TEXT NOT NULL CHECK (source IN ('DESK', 'TABLET', 'PATIENT_080', 'IMPORT')),
        decided_at TEXT NOT NULL,
        decided_by TEXT,
        evidence_document_id TEXT
      ) STRICT
    `
    yield* sql`CREATE INDEX patient_consents_patient ON patient_consents (tenant_id, patient_id, seq)`
    // 열람 기록은 환자·사용자를 지워도 남아야 하므로 외래 키를 두지 않습니다
    yield* sql`
      CREATE TABLE access_logs (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        time TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        reason TEXT
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
