import { Context, Effect, Layer, Option, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { SqlError } from 'effect/sql'
import type { DomainEvent } from '../../shared/events/domain-event.ts'
import { Outbox } from '../../shared/events/outbox.ts'
import type { Id } from '../../shared/ids/ids.types.ts'
import { VersionMismatch } from '../../shared/problem/problem.ts'
import { ChartNumberTaken, DuplicateRrn, initialsOf, matchesQuery, phoneDigitsOf } from './patient.ts'
import type { Address, Consent, Contact, PatientQuery, PatientRecord } from './patient.ts'

/** 새 환자입니다. `chartNumber`가 `null`이면 저장소가 그 순간 채번합니다. */
export type NewPatientRecord = Omit<PatientRecord, 'chartNumber'> & { chartNumber: string | null }

export interface PatientSearch {
  query: PatientQuery | null
  /** 이 개수보다 하나 더 읽어, 다음 쪽이 있는지 알 수 있게 합니다. */
  limit: number
  /** 앞 쪽의 마지막 환자입니다. 이름, ID 순서로 그 뒤부터 읽습니다. */
  after: { name: string; id: string } | null
}

/** 저장된 동의 기록입니다. */
export interface ConsentRecord extends Consent {
  patientId: Id<'patient'>
}

/**
 * 환자 저장소입니다. 모든 조회와 쓰기는 병원(`tenantId`) 안에서만 합니다.
 *
 * - 차트번호는 병원 안에서 유일합니다. 자동 채번은 숫자 차트번호 중 가장 큰 값 + 1이고, 비교·채번·쓰기를 한 번에 해 동시
 *   등록에도 같은 번호가 나오지 않습니다. 숫자가 아닌 차트번호는 채번에서 빠집니다
 * - 주민등록번호는 색인(`rrnIndex`)으로 병원 안 중복을 막습니다
 * - 동의는 덮어쓰지 않고 기록을 쌓습니다
 *
 * 쓰기와 outbox 쓰기는 한 번에 합니다. 하나라도 실패하면 아무것도 남지 않습니다.
 */
export class PatientRepository extends Context.Service<
  PatientRepository,
  {
    create(
      record: NewPatientRecord,
      events: (saved: PatientRecord) => ReadonlyArray<DomainEvent>,
    ): Effect.Effect<PatientRecord, ChartNumberTaken | DuplicateRrn>
    /** `expectedVersion`이 저장된 버전과 다르면 `VersionMismatch`입니다. */
    update(
      record: PatientRecord,
      options: { expectedVersion: number; events: ReadonlyArray<DomainEvent> },
    ): Effect.Effect<void, VersionMismatch | ChartNumberTaken | DuplicateRrn>
    findById(tenantId: Id<'tenant'>, id: Id<'patient'>): Effect.Effect<Option.Option<PatientRecord>>
    /** 이름, ID 순서로 `limit`개까지 줍니다. */
    search(tenantId: Id<'tenant'>, input: PatientSearch): Effect.Effect<ReadonlyArray<PatientRecord>>
    /** 지금 채번하면 받을 번호입니다. 보여 주기만 하고 잡아 두지 않습니다. */
    nextChartNumber(tenantId: Id<'tenant'>): Effect.Effect<string>
    appendConsent(
      tenantId: Id<'tenant'>,
      record: ConsentRecord,
      events: ReadonlyArray<DomainEvent>,
    ): Effect.Effect<void>
    /** 환자들의 동의 기록입니다. 기록한 순서입니다. */
    consentsOf(
      tenantId: Id<'tenant'>,
      patientIds: ReadonlyArray<Id<'patient'>>,
    ): Effect.Effect<ReadonlyArray<ConsentRecord>>
  }
>()('hemr/patients/PatientRepository') {
  static readonly layerMemory = Layer.effect(
    PatientRepository,
    Effect.gen(function* () {
      const patients = yield* Ref.make(new Map<string, PatientRecord>())
      const consents = yield* Ref.make<ReadonlyArray<ConsentRecord & { tenantId: string }>>([])
      const outbox = yield* Outbox

      const sameTenant = (all: Map<string, PatientRecord>, tenantId: string) =>
        [...all.values()].filter((each) => each.tenantId === tenantId)
      const next = (all: Map<string, PatientRecord>, tenantId: string) =>
        String(
          Math.max(
            0,
            ...sameTenant(all, tenantId)
              .map((each) => chartSeqOf(each.chartNumber))
              .filter((seq) => seq !== null),
          ) + 1,
        )
      /** 다른 환자와 차트번호나 주민등록번호 색인이 겹치는지 봅니다. */
      const clash = (all: Map<string, PatientRecord>, record: PatientRecord) => {
        const others = sameTenant(all, record.tenantId).filter((each) => each.id !== record.id)
        const rrn = record.rrnIndex === null ? undefined : others.find((each) => each.rrnIndex === record.rrnIndex)
        if (rrn !== undefined) return new DuplicateRrn({ patientId: rrn.id })
        if (others.some((each) => each.chartNumber === record.chartNumber)) {
          return new ChartNumberTaken({ chartNumber: record.chartNumber })
        }
        return null
      }

      return PatientRepository.of({
        create: (record, events) =>
          Effect.gen(function* () {
            // 채번·비교·쓰기를 `Ref.modify` 한 번에 해, 동시에 등록해도 SQL 구현처럼 하나만 통과합니다
            const result = yield* Ref.modify(
              patients,
              (all): readonly [PatientRecord | ChartNumberTaken | DuplicateRrn, Map<string, PatientRecord>] => {
                const saved = { ...record, chartNumber: record.chartNumber ?? next(all, record.tenantId) }
                // ID는 새 ULID라 겹치지 않습니다. 겹치면 호출한 쪽의 잘못입니다
                if (all.has(saved.id)) throw new Error(`patient ${saved.id} already exists`)
                const error = clash(all, saved)
                return error === null ? [saved, new Map(all).set(saved.id, structuredClone(saved))] : [error, all]
              },
            )
            if (result instanceof ChartNumberTaken || result instanceof DuplicateRrn) return yield* result
            yield* outbox.append(events(result))
            return result
          }),
        update: (record, options) =>
          Effect.gen(function* () {
            const error = yield* Ref.modify(
              patients,
              (
                all,
              ): readonly [VersionMismatch | ChartNumberTaken | DuplicateRrn | null, Map<string, PatientRecord>] => {
                const current = all.get(record.id)
                if (current === undefined || current.tenantId !== record.tenantId) {
                  return [new VersionMismatch({ currentVersion: 0 }), all]
                }
                if (current.version !== options.expectedVersion) {
                  return [new VersionMismatch({ currentVersion: current.version }), all]
                }
                const found = clash(all, record)
                return found === null ? [null, new Map(all).set(record.id, structuredClone(record))] : [found, all]
              },
            )
            if (error !== null) return yield* error
            yield* outbox.append(options.events)
          }),
        findById: (tenantId, id) =>
          Ref.get(patients).pipe(
            Effect.map((all) =>
              Option.map(
                Option.filter(Option.fromNullishOr(all.get(id)), (each) => each.tenantId === tenantId),
                structuredClone,
              ),
            ),
          ),
        search: (tenantId, input) =>
          Ref.get(patients).pipe(
            Effect.map((all) =>
              sameTenant(all, tenantId)
                .filter((each) => input.query === null || matchesQuery(each, input.query))
                .filter((each) => input.after === null || compareKey(each, input.after) > 0)
                .sort(compareKey)
                .slice(0, input.limit)
                .map((each) => structuredClone(each)),
            ),
          ),
        nextChartNumber: (tenantId) => Ref.get(patients).pipe(Effect.map((all) => next(all, tenantId))),
        appendConsent: (tenantId, record, events) =>
          Ref.update(consents, (all) => [...all, { ...record, tenantId }]).pipe(Effect.andThen(outbox.append(events))),
        consentsOf: (tenantId, patientIds) =>
          Ref.get(consents).pipe(
            Effect.map((all) =>
              all
                .filter((each) => each.tenantId === tenantId && patientIds.includes(each.patientId))
                .map(({ tenantId: _, ...each }) => each),
            ),
          ),
      })
    }),
  )

  /** SQL 테이블 `patients`·`patient_consents`에 보관합니다. 마이그레이션 `0005`가 만듭니다. */
  static readonly layerSql = Layer.effect(
    PatientRepository,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const outbox = yield* Outbox

      interface Row {
        id: string
        tenantId: string
        chartNumber: string
        name: string
        rrnSealed: string | null
        rrnIndex: string | null
        rrnMasked: string | null
        birthDate: string | null
        isLunarBirthday: number
        sex: PatientRecord['sex']
        contacts: string
        addresses: string
        notes: string | null
        firstVisitDate: string | null
        createdAt: string
        updatedAt: string
        version: number
      }
      const toRecord = (row: Row): PatientRecord => ({
        ...row,
        id: row.id as PatientRecord['id'],
        tenantId: row.tenantId as PatientRecord['tenantId'],
        isLunarBirthday: row.isLunarBirthday === 1,
        contacts: JSON.parse(row.contacts) as Contact[],
        addresses: JSON.parse(row.addresses) as Address[],
        status: 'ACTIVE',
      })
      const columns = sql`id, tenant_id AS tenantId, chart_number AS chartNumber, name, rrn_sealed AS rrnSealed,
        rrn_index AS rrnIndex, rrn_masked AS rrnMasked, birth_date AS birthDate,
        is_lunar_birthday AS isLunarBirthday, sex, contacts, addresses, notes,
        first_visit_date AS firstVisitDate, created_at AS createdAt, updated_at AS updatedAt, version`
      /** 차트번호 외의 열입니다. 등록과 수정이 함께 씁니다. */
      const values = (record: Omit<PatientRecord, 'chartNumber' | 'id' | 'tenantId' | 'createdAt'>) => ({
        name: record.name,
        name_initials: initialsOf(record.name),
        name_folded: record.name.toLowerCase(),
        rrn_sealed: record.rrnSealed,
        rrn_index: record.rrnIndex,
        rrn_masked: record.rrnMasked,
        birth_date: record.birthDate,
        is_lunar_birthday: record.isLunarBirthday ? 1 : 0,
        sex: record.sex,
        contacts: JSON.stringify(record.contacts),
        phone_digits: phoneDigitsOf(record.contacts),
        addresses: JSON.stringify(record.addresses),
        notes: record.notes,
        first_visit_date: record.firstVisitDate,
        status: record.status,
        updated_at: record.updatedAt,
        version: record.version,
      })
      const nextSeq = (tenantId: string) =>
        sql<{ next: number }>`
          SELECT COALESCE(MAX(chart_seq), 0) + 1 AS next FROM patients WHERE tenant_id = ${tenantId}
        `.pipe(Effect.map((rows) => rows[0]?.next ?? 1))
      const rrnOwner = (tenantId: string, rrnIndex: string | null, exceptId: string) =>
        rrnIndex === null
          ? Effect.succeed(Option.none<string>())
          : sql<{ id: string }>`
              SELECT id FROM patients WHERE tenant_id = ${tenantId} AND rrn_index = ${rrnIndex} AND id <> ${exceptId}
            `.pipe(Effect.map((rows) => Option.fromNullishOr(rows[0]?.id)))
      /** 유니크 제약에 걸린 쓰기를 업무 오류로 바꿉니다. 주민번호 색인은 먼저 확인하므로 남는 것은 차트번호입니다. */
      const uniqueToTaken =
        (chartNumber: string) =>
        <A, R>(effect: Effect.Effect<A, SqlError.SqlError, R>) =>
          effect.pipe(
            Effect.catchTag('SqlError', (error) =>
              error.reason._tag === 'UniqueViolation'
                ? Effect.fail(new ChartNumberTaken({ chartNumber }))
                : Effect.die(error),
            ),
          )

      return PatientRepository.of({
        create: (record, events) =>
          Effect.gen(function* () {
            // 주민번호 중복은 기존 환자 ID를 알려 줘야 해 먼저 찾습니다. 같은 트랜잭션이라 사이에 끼어들 쓰기가 없습니다
            const owner = yield* rrnOwner(record.tenantId, record.rrnIndex, record.id)
            if (Option.isSome(owner)) return yield* new DuplicateRrn({ patientId: owner.value as PatientRecord['id'] })
            const chartNumber = record.chartNumber ?? String(yield* nextSeq(record.tenantId))
            const saved: PatientRecord = { ...record, chartNumber }
            yield* sql`
              INSERT INTO patients ${sql.insert({
                id: saved.id,
                tenant_id: saved.tenantId,
                chart_number: chartNumber,
                chart_seq: chartSeqOf(chartNumber),
                created_at: saved.createdAt,
                ...values(saved),
              })}
            `.pipe(uniqueToTaken(chartNumber))
            yield* outbox.append(events(saved))
            return saved
          }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die)),
        update: (record, options) =>
          Effect.gen(function* () {
            const owner = yield* rrnOwner(record.tenantId, record.rrnIndex, record.id)
            if (Option.isSome(owner)) return yield* new DuplicateRrn({ patientId: owner.value as PatientRecord['id'] })
            const written = yield* sql<{ id: string }>`
              UPDATE patients SET ${sql.update({
                chart_number: record.chartNumber,
                chart_seq: chartSeqOf(record.chartNumber),
                ...values(record),
              })}
              WHERE id = ${record.id} AND tenant_id = ${record.tenantId} AND version = ${options.expectedVersion}
              RETURNING id
            `.pipe(uniqueToTaken(record.chartNumber))
            if (written.length === 0) {
              const current = yield* sql<{ version: number }>`
                SELECT version FROM patients WHERE id = ${record.id} AND tenant_id = ${record.tenantId}
              `
              return yield* new VersionMismatch({ currentVersion: current[0]?.version ?? 0 })
            }
            yield* outbox.append(options.events)
          }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die)),
        findById: (tenantId, id) =>
          sql<Row>`SELECT ${columns} FROM patients WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toRecord)),
            Effect.orDie,
          ),
        search: (tenantId, input) => {
          const conditions = [sql`tenant_id = ${tenantId}`]
          if (input.query !== null) conditions.push(queryCondition(sql, input.query))
          if (input.after !== null) {
            const { name, id } = input.after
            conditions.push(sql`(name > ${name} OR (name = ${name} AND id > ${id}))`)
          }
          return sql<Row>`
            SELECT ${columns} FROM patients WHERE ${sql.and(conditions)}
            ORDER BY name, id LIMIT ${input.limit}
          `.pipe(
            Effect.map((rows) => rows.map(toRecord)),
            Effect.orDie,
          )
        },
        nextChartNumber: (tenantId) => nextSeq(tenantId).pipe(Effect.map(String), Effect.orDie),
        appendConsent: (tenantId, record, events) =>
          Effect.gen(function* () {
            yield* sql`
              INSERT INTO patient_consents ${sql.insert({
                tenant_id: tenantId,
                patient_id: record.patientId,
                purpose: record.purpose,
                status: record.status,
                source: record.source,
                decided_at: record.decidedAt,
                decided_by: record.decidedBy,
                evidence_document_id: record.evidenceDocumentId,
              })}
            `
            yield* outbox.append(events)
          }).pipe(sql.withTransaction, Effect.orDie),
        consentsOf: (tenantId, patientIds) =>
          patientIds.length === 0
            ? Effect.succeed([])
            : sql<ConsentRecord>`
                SELECT patient_id AS patientId, purpose, status, source, decided_at AS decidedAt,
                  decided_by AS decidedBy, evidence_document_id AS evidenceDocumentId
                FROM patient_consents
                WHERE tenant_id = ${tenantId} AND ${sql.in('patient_id', patientIds)}
                ORDER BY seq
              `.pipe(Effect.orDie),
      })
    }),
  )
}

/** 숫자로만 된 차트번호의 값입니다. 자동 채번은 이 값의 최댓값 + 1입니다. */
function chartSeqOf(chartNumber: string): number | null {
  return /^\d{1,15}$/.test(chartNumber) ? Number(chartNumber) : null
}

function compareKey(a: { name: string; id: string }, b: { name: string; id: string }): number {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** `LIKE`의 특수 문자를 글자 그대로 찾도록 막습니다. 조건에 `ESCAPE '\'`를 붙여 씁니다. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/** `matchesQuery`와 같은 규칙의 SQL 조건입니다. */
function queryCondition(sql: SqlClient.SqlClient, query: PatientQuery) {
  switch (query.kind) {
    case 'DIGITS': {
      const digits = escapeLike(query.digits)
      const raw = escapeLike(query.raw)
      return sql`(chart_number LIKE ${`${digits}%`} ESCAPE '\\' OR chart_number LIKE ${`${raw}%`} ESCAPE '\\'
        OR phone_digits LIKE ${`%${digits} %`} ESCAPE '\\')`
    }
    case 'INITIALS':
      return sql`name_initials LIKE ${`%${escapeLike(query.initials)}%`} ESCAPE '\\'`
    case 'TEXT': {
      const text = escapeLike(query.text)
      // SQLite의 `lower()`는 ASCII만 바꾸므로, 저장할 때 JS로 소문자로 바꾼 `name_folded`를 찾습니다
      return sql`(name_folded LIKE ${`%${text}%`} ESCAPE '\\' OR lower(chart_number) LIKE ${`${text}%`} ESCAPE '\\')`
    }
  }
}
