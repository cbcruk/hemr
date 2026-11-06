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
  '0006_visit_check_in': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // 0004와 같은 이유로 테이블을 새로 만듭니다. 이 마이그레이션 전에는 접수 엔드포인트가 없어 있는 내원은 개발용
    // 샘플뿐입니다. 실제 데이터가 생긴 뒤의 열 추가는 옮기는 마이그레이션으로 해야 합니다.
    // eligibility·benefit_flags는 내원의 하위 값이라 JSON으로 둡니다. 본인확인 이력은 json_extract로 셉니다
    yield* sql`DROP TABLE visits`
    yield* sql`
      CREATE TABLE visits (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        date TEXT NOT NULL,
        checked_in_at TEXT NOT NULL,
        coverage TEXT NOT NULL
          CHECK (coverage IN ('NHIS', 'MEDICAL_AID', 'AUTO_INSURANCE', 'INDUSTRIAL_ACCIDENT', 'SELF_PAY')),
        is_first_visit INTEGER NOT NULL CHECK (is_first_visit IN (0, 1)),
        eligibility TEXT NOT NULL CHECK (json_valid(eligibility)),
        benefit_flags TEXT NOT NULL CHECK (json_valid(benefit_flags)),
        status TEXT NOT NULL
          CHECK (status IN ('WAITING', 'IN_TREATMENT', 'AWAITING_PAYMENT', 'COMPLETED', 'CANCELED')),
        status_changed_at TEXT NOT NULL,
        status_reason TEXT,
        has_clinical_data INTEGER NOT NULL CHECK (has_clinical_data IN (0, 1)),
        version INTEGER NOT NULL CHECK (version >= 1)
      ) STRICT
    `
    yield* sql`CREATE INDEX visits_tenant_date ON visits (tenant_id, date, checked_in_at)`
    yield* sql`CREATE INDEX visits_tenant_patient ON visits (tenant_id, patient_id)`
  }),
  '0007_encounters': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // 접수가 내원과 진료를 함께 만듭니다. 0006 뒤로 실제 접수가 생겨 내원을 지우지 않고 열을 더합니다. 이 전에 접수한
    // 내원은 진료가 없어 비어 있습니다
    yield* sql`ALTER TABLE visits ADD COLUMN encounter_id TEXT`
    // 본문은 검색하지 않는 긴 문자열이라 열 하나로, 상병·표시는 진료의 하위 값이라 JSON으로 둡니다
    yield* sql`
      CREATE TABLE encounters (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        visit_id TEXT,
        doctor_id TEXT,
        encounter_type TEXT NOT NULL CHECK (encounter_type IN ('OFFICE', 'HOME_VISIT', 'TELEMEDICINE')),
        coverage TEXT NOT NULL
          CHECK (coverage IN ('NHIS', 'MEDICAL_AID', 'AUTO_INSURANCE', 'INDUSTRIAL_ACCIDENT', 'SELF_PAY')),
        service_at TEXT NOT NULL,
        note_body TEXT NOT NULL,
        diagnoses TEXT NOT NULL CHECK (json_valid(diagnoses)),
        benefit_flags TEXT NOT NULL CHECK (json_valid(benefit_flags)),
        status TEXT NOT NULL CHECK (status IN ('DRAFT', 'COMPLETED', 'AMENDED', 'ENTERED_IN_ERROR')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version >= 1)
      ) STRICT
    `
    yield* sql`CREATE INDEX encounters_tenant_patient ON encounters (tenant_id, patient_id, service_at)`
    // 내원 하나에 진료 하나입니다
    yield* sql`CREATE UNIQUE INDEX encounters_visit ON encounters (visit_id) WHERE visit_id IS NOT NULL`
  }),
  '0008_prescription_lines': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // 처방 라인은 상병처럼 진료의 하위 값이라 JSON 열로 둡니다. 이 전에 만든 진료는 라인이 없습니다
    yield* sql`
      ALTER TABLE encounters ADD COLUMN prescription_lines TEXT NOT NULL DEFAULT '[]'
        CHECK (json_valid(prescription_lines))
    `
  }),
  '0009_encounter_completion': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // 이 전에 만든 진료는 모두 초안이라 완료 시각이 없습니다
    yield* sql`ALTER TABLE encounters ADD COLUMN completed_at TEXT`
  }),
  '0010_encounter_revisions': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`ALTER TABLE encounters ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)`
    yield* sql`ALTER TABLE encounters ADD COLUMN locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1))`
    yield* sql`
      ALTER TABLE encounters ADD COLUMN retraction TEXT CHECK (retraction IS NULL OR json_valid(retraction))
    `
    // 진료기록 판은 추가만 합니다 (compliance.md 진료기록 정정). 고치거나 지우는 문장은 트리거가 막습니다
    yield* sql`
      CREATE TABLE encounter_revisions (
        tenant_id TEXT NOT NULL,
        encounter_id TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK (revision >= 1),
        note_body TEXT NOT NULL,
        diagnoses TEXT NOT NULL CHECK (json_valid(diagnoses)),
        prescription_lines TEXT NOT NULL CHECK (json_valid(prescription_lines)),
        source TEXT NOT NULL CHECK (source IN ('COMPLETION', 'AMENDMENT')),
        reason TEXT,
        recorded_by TEXT,
        recorded_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, encounter_id, revision)
      ) STRICT
    `
    yield* sql`
      CREATE TRIGGER encounter_revisions_no_update BEFORE UPDATE ON encounter_revisions
      BEGIN SELECT RAISE(ABORT, 'encounter revisions are append-only'); END
    `
    yield* sql`
      CREATE TRIGGER encounter_revisions_no_delete BEFORE DELETE ON encounter_revisions
      BEGIN SELECT RAISE(ABORT, 'encounter revisions are append-only'); END
    `
    // 0009 뒤로 완료한 진료는 그 내용을 1판으로 옮깁니다
    yield* sql`
      INSERT INTO encounter_revisions
        (tenant_id, encounter_id, revision, note_body, diagnoses, prescription_lines, source, reason, recorded_by,
         recorded_at)
      SELECT tenant_id, id, 1, note_body, diagnoses, prescription_lines, 'COMPLETION', NULL, doctor_id, completed_at
      FROM encounters WHERE status = 'COMPLETED'
    `
    yield* sql`UPDATE encounters SET revision = 1 WHERE status = 'COMPLETED'`
    // 취소한 내원의 진료는 이제 취소와 함께 철회합니다. 그 전에 취소한 내원의 진료도 같게 맞춥니다. 사유와 시각은
    // 내원 취소에서 가져오고, 누가 취소했는지는 내원에 남지 않아 비워 둡니다
    yield* sql`
      UPDATE encounters SET
        status = 'ENTERED_IN_ERROR',
        retraction = (
          SELECT json_object(
            'reason', coalesce(visits.status_reason, 'Visit canceled'),
            'retractedAt', visits.status_changed_at,
            'retractedBy', NULL
          )
          FROM visits WHERE visits.id = encounters.visit_id
        ),
        version = version + 1
      WHERE status != 'ENTERED_IN_ERROR'
        AND visit_id IN (SELECT id FROM visits WHERE status = 'CANCELED' AND tenant_id = encounters.tenant_id)
    `
  }),
  '0011_procedures': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`
      CREATE TABLE procedures (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        visit_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        name TEXT NOT NULL,
        source_prescription_line_id TEXT,
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        assignee TEXT NOT NULL CHECK (assignee IN ('DOCTOR', 'STAFF')),
        duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 1),
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'TIMER_ELAPSED', 'DONE')),
        started_at TEXT,
        timer_ends_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version >= 1),
        -- 진행 중·만료 시술은 시작·종료 시각이 늘 있습니다 (procedure-timer 결정 3)
        CHECK (status NOT IN ('RUNNING', 'TIMER_ELAPSED') OR (started_at IS NOT NULL AND timer_ends_at IS NOT NULL))
      ) STRICT
    `
    yield* sql`CREATE INDEX procedures_tenant_visit ON procedures (tenant_id, visit_id, sort_order)`
    // 서버 타이머가 끝난 진행 중 시술을 자주 찾습니다
    yield* sql`CREATE INDEX procedures_running ON procedures (timer_ends_at) WHERE status = 'RUNNING'`
  }),
  '0012_receipts': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // 결제·청구·결산은 영수증과 함께만 읽고 쓰므로 JSON으로 둡니다. 외부 승인 결제(#34)가 생기면 결제를 테이블로 옮깁니다
    yield* sql`
      CREATE TABLE receipts (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        visit_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        date TEXT NOT NULL,
        cashier_id TEXT NOT NULL,
        memo TEXT NOT NULL,
        encounter_ids TEXT NOT NULL,
        quote_id TEXT NOT NULL,
        charges TEXT NOT NULL,
        payments TEXT NOT NULL,
        settlement TEXT NOT NULL,
        flags TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'VOIDED')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version >= 1)
      ) STRICT
    `
    // 내원 하나에 유효한 영수증은 하나입니다
    yield* sql`CREATE UNIQUE INDEX receipts_active_visit ON receipts (tenant_id, visit_id) WHERE status = 'ACTIVE'`
    yield* sql`CREATE INDEX receipts_tenant_date ON receipts (tenant_id, date)`
    yield* sql`
      CREATE TABLE idempotency_keys (
        tenant_id TEXT NOT NULL,
        key TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        response TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, key)
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
