import { Clock, Context, Effect, Layer, Option } from 'effect'
import { AccessLog } from '../../shared/audit/access-log.ts'
import { domainEvent } from '../../shared/events/domain-event.ts'
import { isId, newId } from '../../shared/ids/ids.ts'
import type { Id } from '../../shared/ids/ids.types.ts'
import { ValidationFailed, VersionMismatch } from '../../shared/problem/problem.ts'
import { CurrentAccess } from '../identity/auth/access.ts'
import { ConsentLockedByPatient, PatientNotFound } from './patient.ts'
import type { Address, ChartNumberTaken, Consent, Contact, DuplicateRrn, Patient, PatientRecord } from './patient.ts'
import { classifyQuery } from './patient.ts'
import { PatientCrypto } from './patient-crypto.ts'
import { PatientRepository } from './patient-repository.ts'
import type { ConsentRecord } from './patient-repository.ts'
import { birthDateOf, maskRrn, normalizeRrn, sexOf } from './rrn.ts'

/** 환자 등록 입력입니다. `chartNumber`를 비우면 서버가 채번합니다. */
export interface RegisterPatientInput {
  name: string
  chartNumber?: string
  /** 주면 비어 있는 `birthDate`·`sex`를 이 번호에서 채웁니다. */
  rrn?: string
  birthDate?: string
  isLunarBirthday?: boolean
  sex?: Patient['sex']
  contacts?: ReadonlyArray<Contact>
  addresses?: ReadonlyArray<Address>
  notes?: string
}

/** 바꿀 필드만 보냅니다. `null`은 값을 지웁니다. 컬렉션(`contacts`·`addresses`)은 통째로 바꿉니다. */
export interface UpdatePatientInput {
  name?: string
  chartNumber?: string
  rrn?: string | null
  birthDate?: string | null
  isLunarBirthday?: boolean
  sex?: Patient['sex']
  contacts?: ReadonlyArray<Contact>
  addresses?: ReadonlyArray<Address>
  notes?: string | null
}

/**
 * 직원이 기록하는 동의입니다. 출처는 늘 `DESK`입니다. 태블릿(`TABLET`)은 환자 본인의 기록이라 기기 토큰이 생기면
 * 그 입구에서만 쓰고, 080 거부와 이관(`PATIENT_080`·`IMPORT`)은 연동·이관 작업만 씁니다.
 */
export interface RecordConsentInput {
  purpose: string
  status: Consent['status']
  evidenceDocumentId?: string
}

export interface PatientPage {
  items: Patient[]
  /** 다음 쪽 커서입니다. 마지막 쪽이면 `null`입니다. */
  nextCursor: string | null
}

type Errors = ChartNumberTaken | DuplicateRrn | ValidationFailed

/**
 * 환자 등록·조회·수정과 동의입니다 (patients.md). 모든 작업은 현재 사용자(`CurrentAccess`)가 고른 병원 안에서 합니다.
 * 다른 병원의 환자는 404 `PATIENT_NOT_FOUND`입니다.
 */
export class Patients extends Context.Service<
  Patients,
  {
    /** 같은 트랜잭션에서 `patient.created`를 냅니다. */
    register(input: RegisterPatientInput): Effect.Effect<Patient, Errors, CurrentAccess>
    get(id: Id<'patient'>): Effect.Effect<Patient, PatientNotFound, CurrentAccess>
    /** 이름, ID 순서입니다. `limit`은 1–200입니다. */
    search(input: {
      q?: string
      limit: number
      cursor?: string
    }): Effect.Effect<PatientPage, ValidationFailed, CurrentAccess>
    /**
     * 바뀐 필드가 있으면 버전을 올리고 `patient.updated`(바뀐 필드 이름)를 냅니다. 바뀐 것이 없으면 그대로 돌려줍니다.
     * `expectedVersion`이 없으면 다시 읽어 3번까지 다시 시도합니다(내원 커맨드와 같습니다).
     */
    update(
      id: Id<'patient'>,
      input: UpdatePatientInput,
      options?: { expectedVersion?: number },
    ): Effect.Effect<Patient, PatientNotFound | VersionMismatch | Errors, CurrentAccess>
    /** 주민등록번호 원문입니다. 주기 전에 사유와 함께 열람 기록(`READ_RRN`)을 남깁니다. */
    revealRrn(id: Id<'patient'>, reason: string): Effect.Effect<{ rrn: string | null }, PatientNotFound, CurrentAccess>
    nextChartNumber(): Effect.Effect<{ chartNumber: string }, never, CurrentAccess>
    consentHistory(id: Id<'patient'>): Effect.Effect<Consent[], PatientNotFound, CurrentAccess>
    /**
     * 동의 기록을 하나 더하고 `consent.changed`를 냅니다. 환자가 080으로 거부한 목적은, 그 뒤에 환자 본인의 동의
     * (`TABLET`·`PATIENT_080`의 `GRANTED`)가 없으면 직원이 `GRANTED`로 되돌릴 수 없습니다(409 `CONSENT_LOCKED_BY_PATIENT`).
     * 사이에 다른 상태를 끼워 넣어도 풀리지 않습니다.
     */
    recordConsent(
      id: Id<'patient'>,
      input: RecordConsentInput,
    ): Effect.Effect<Consent, PatientNotFound | ConsentLockedByPatient, CurrentAccess>
  }
>()('hemr/patients/Patients') {
  static readonly layer = Layer.effect(
    Patients,
    Effect.gen(function* () {
      const repository = yield* PatientRepository
      const crypto = yield* PatientCrypto
      const accessLog = yield* AccessLog

      const now = Clock.currentTimeMillis.pipe(Effect.map((millis) => new Date(millis).toISOString()))
      const context = (access: CurrentAccess['Service']) => ({
        tenantId: access.tenantId,
        actor: { kind: 'USER' as const, id: access.userId },
      })

      const find = (access: CurrentAccess['Service'], id: Id<'patient'>) =>
        repository
          .findById(access.tenantId, id)
          .pipe(
            Effect.flatMap(
              Option.match({ onNone: () => Effect.fail(new PatientNotFound({})), onSome: Effect.succeed }),
            ),
          )
      /** 저장 기록에 목적별 현재 동의를 붙여 응답 모양으로 바꿉니다. 암호문과 색인은 빼냅니다. */
      const withConsents = (tenantId: Id<'tenant'>, records: ReadonlyArray<PatientRecord>) =>
        repository
          .consentsOf(
            tenantId,
            records.map((each) => each.id),
          )
          .pipe(
            Effect.map((all) =>
              records.map(({ rrnSealed: _, rrnIndex: __, ...record }): Patient => ({
                ...record,
                consents: currentConsents(all.filter((each) => each.patientId === record.id)),
              })),
            ),
          )
      const toPatient = (record: PatientRecord) =>
        withConsents(record.tenantId, [record]).pipe(Effect.map((each) => each[0]!))
      /** 주민등록번호 숫자를 저장할 세 값(암호문·색인·가린 번호)으로 바꿉니다. */
      const sealed = (tenantId: Id<'tenant'>, id: Id<'patient'>, digits: string | null) =>
        digits === null
          ? { rrnSealed: null, rrnIndex: null, rrnMasked: null }
          : {
              rrnSealed: crypto.sealRrn(tenantId, id, digits),
              rrnIndex: crypto.rrnIndex(tenantId, digits),
              rrnMasked: maskRrn(digits),
            }

      const register = Effect.fn('Patients.register')(function* (input: RegisterPatientInput) {
        const access = yield* CurrentAccess
        const time = yield* now
        const id = newId('patient', Date.parse(time))
        const digits = input.rrn === undefined ? null : normalizeRrn(input.rrn)
        const record = {
          id,
          tenantId: access.tenantId,
          chartNumber: input.chartNumber ?? null,
          name: input.name.trim(),
          ...sealed(access.tenantId, id, digits),
          birthDate: input.birthDate ?? (digits === null ? null : birthDateOf(digits)),
          isLunarBirthday: input.isLunarBirthday ?? false,
          sex: input.sex ?? (digits === null ? null : sexOf(digits)),
          contacts: input.contacts ?? [],
          addresses: input.addresses ?? [],
          notes: input.notes ?? null,
          firstVisitDate: null,
          status: 'ACTIVE' as const,
          createdAt: time,
          updatedAt: time,
          version: 1,
        }
        yield* validate(record, digits)
        const saved = yield* repository.create(record, (each) => [
          domainEvent('patient.created', id, time, { patientId: id, chartNumber: each.chartNumber }, context(access)),
        ])
        return yield* toPatient(saved)
      })

      const attemptUpdate = Effect.fn('Patients.update')(function* (
        id: Id<'patient'>,
        input: UpdatePatientInput,
        expectedVersion: number | undefined,
      ) {
        const access = yield* CurrentAccess
        const current = yield* find(access, id)
        if (expectedVersion !== undefined && expectedVersion !== current.version) {
          return yield* new VersionMismatch({ currentVersion: current.version })
        }
        const digits = input.rrn === undefined || input.rrn === null ? null : normalizeRrn(input.rrn)
        const rrn = input.rrn === undefined ? {} : sealed(access.tenantId, id, digits)
        const { rrn: _, ...fields } = input
        const merged: PatientRecord = {
          ...current,
          ...fields,
          ...(fields.name === undefined ? {} : { name: fields.name.trim() }),
          ...rrn,
        }
        const changed = changedFields(current, merged)
        if (changed.length === 0) return yield* toPatient(current)
        // 생년월일·성별과 맞는지 보려면 바뀌지 않은 번호도 원문이 필요합니다
        const finalDigits =
          input.rrn !== undefined
            ? digits
            : current.rrnSealed === null
              ? null
              : crypto.openRrn(current.tenantId, current.id, current.rrnSealed)
        yield* validate(merged, finalDigits)
        const time = yield* now
        const next: PatientRecord = { ...merged, updatedAt: time, version: current.version + 1 }
        yield* repository.update(next, {
          expectedVersion: current.version,
          events: [domainEvent('patient.updated', id, time, { patientId: id, fields: changed }, context(access))],
        })
        return yield* toPatient(next)
      })

      const update = (id: Id<'patient'>, input: UpdatePatientInput, options: { expectedVersion?: number } = {}) =>
        options.expectedVersion === undefined
          ? attemptUpdate(id, input, undefined).pipe(
              Effect.retry({ while: (error) => error._tag === 'VersionMismatch', times: 3 }),
            )
          : attemptUpdate(id, input, options.expectedVersion)

      const search = Effect.fn('Patients.search')(function* (input: { q?: string; limit: number; cursor?: string }) {
        const access = yield* CurrentAccess
        // 커서는 앞 쪽 마지막 환자의 ID입니다. 이름을 싣지 않으려고 이름은 서버에서 다시 읽습니다
        const cursor =
          input.cursor === undefined
            ? Option.none()
            : isId('patient', input.cursor)
              ? yield* repository.findById(access.tenantId, input.cursor)
              : undefined
        if (cursor === undefined || (input.cursor !== undefined && Option.isNone(cursor))) {
          return yield* new ValidationFailed({ violations: [{ field: 'cursor', code: 'INVALID_VALUE' }] })
        }
        const after = Option.match(cursor, { onNone: () => null, onSome: ({ name, id }) => ({ name, id }) })
        const rows = yield* repository.search(access.tenantId, {
          query: input.q === undefined ? null : classifyQuery(input.q),
          limit: input.limit + 1,
          after,
        })
        const page = rows.slice(0, input.limit)
        const last = page.at(-1)
        return {
          items: yield* withConsents(access.tenantId, page),
          nextCursor: rows.length > input.limit && last !== undefined ? last.id : null,
        }
      })

      const revealRrn = Effect.fn('Patients.revealRrn')(function* (id: Id<'patient'>, reason: string) {
        const access = yield* CurrentAccess
        const record = yield* find(access, id)
        yield* accessLog.record({
          time: yield* now,
          tenantId: access.tenantId,
          userId: access.userId,
          action: 'READ_RRN',
          resource: 'patient',
          resourceId: id,
          reason,
        })
        if (record.rrnSealed === null) return { rrn: null }
        const digits = crypto.openRrn(record.tenantId, record.id, record.rrnSealed)
        return { rrn: `${digits.slice(0, 6)}-${digits.slice(6)}` }
      })

      const consentHistory = Effect.fn('Patients.consentHistory')(function* (id: Id<'patient'>) {
        const access = yield* CurrentAccess
        yield* find(access, id)
        const all = yield* repository.consentsOf(access.tenantId, [id])
        return all.map(({ patientId: _, ...each }) => each)
      })

      const recordConsent = Effect.fn('Patients.recordConsent')(function* (
        id: Id<'patient'>,
        input: RecordConsentInput,
      ) {
        const access = yield* CurrentAccess
        yield* find(access, id)
        const history = yield* repository.consentsOf(access.tenantId, [id])
        if (input.status === 'GRANTED' && lockedByPatient(history.filter((each) => each.purpose === input.purpose))) {
          return yield* new ConsentLockedByPatient({ purpose: input.purpose })
        }
        const time = yield* now
        const consent: ConsentRecord = {
          patientId: id,
          purpose: input.purpose,
          status: input.status,
          source: 'DESK',
          decidedAt: time,
          decidedBy: access.userId,
          evidenceDocumentId: input.evidenceDocumentId ?? null,
        }
        const { patientId: _, ...result } = consent
        yield* repository.appendConsent(access.tenantId, consent, [
          domainEvent(
            'consent.changed',
            id,
            time,
            { patientId: id, purpose: input.purpose, status: input.status, source: consent.source },
            context(access),
          ),
        ])
        return result
      })

      return Patients.of({
        register,
        get: (id) =>
          CurrentAccess.pipe(
            Effect.flatMap((access) => find(access, id)),
            Effect.flatMap(toPatient),
          ),
        search,
        update,
        revealRrn,
        nextChartNumber: () =>
          CurrentAccess.pipe(
            Effect.flatMap((access) => repository.nextChartNumber(access.tenantId)),
            Effect.map((chartNumber) => ({ chartNumber })),
          ),
        consentHistory,
        recordConsent,
      })
    }),
  )
}

/** 환자 본인이 남긴 기록의 출처입니다. 직원이 대신 고를 수 없습니다. */
const PATIENT_SOURCES: ReadonlySet<Consent['source']> = new Set(['TABLET', 'PATIENT_080'])

/** 한 목적의 기록에서, 마지막 080 거부 뒤에 환자 본인의 동의가 없으면 잠겨 있습니다. */
function lockedByPatient(history: ReadonlyArray<Consent>): boolean {
  const optOut = history.findLastIndex(
    (each) => each.source === 'PATIENT_080' && (each.status === 'DENIED' || each.status === 'WITHDRAWN'),
  )
  if (optOut === -1) return false
  return !history.slice(optOut + 1).some((each) => each.status === 'GRANTED' && PATIENT_SOURCES.has(each.source))
}

/** 목적별 마지막 기록입니다. 목적 이름 순서입니다. */
function currentConsents(history: ReadonlyArray<ConsentRecord>): Consent[] {
  const latest = new Map<string, Consent>()
  for (const { patientId: _, ...each } of history) latest.set(each.purpose, each)
  return [...latest.values()].sort((a, b) => (a.purpose < b.purpose ? -1 : 1))
}

const UPDATABLE = [
  'name',
  'chartNumber',
  'rrnIndex',
  'birthDate',
  'isLunarBirthday',
  'sex',
  'contacts',
  'addresses',
  'notes',
] as const

/** 바뀐 필드 이름입니다. 주민등록번호는 색인으로 비교하고 `rrn`으로 적습니다. */
function changedFields(before: PatientRecord, after: PatientRecord): string[] {
  return UPDATABLE.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map((key) =>
    key === 'rrnIndex' ? 'rrn' : key,
  )
}

/**
 * 스키마로 못 보는 규칙입니다. 대표 연락처·주소는 하나까지이고, 생년월일은 실제 날짜이며, 주민등록번호가 있으면 생년월일·
 * 성별이 번호와 맞아야 합니다. 위반을 모두 모아 400 `VALIDATION_FAILED`로 줍니다.
 */
function validate(
  record: Pick<PatientRecord, 'contacts' | 'addresses' | 'birthDate' | 'sex'>,
  digits: string | null,
): Effect.Effect<void, ValidationFailed> {
  const violations: Array<{ field: string; code: string }> = []
  if (record.contacts.filter((each) => each.isPrimary).length > 1) {
    violations.push({ field: 'contacts', code: 'MULTIPLE_PRIMARY' })
  }
  if (record.addresses.filter((each) => each.isPrimary).length > 1) {
    violations.push({ field: 'addresses', code: 'MULTIPLE_PRIMARY' })
  }
  if (record.birthDate !== null && !isRealDate(record.birthDate)) {
    violations.push({ field: 'birthDate', code: 'INVALID_VALUE' })
  } else if (digits !== null && record.birthDate !== null && record.birthDate !== birthDateOf(digits)) {
    violations.push({ field: 'birthDate', code: 'RRN_MISMATCH' })
  }
  if (digits !== null && record.sex !== null && record.sex !== sexOf(digits)) {
    violations.push({ field: 'sex', code: 'RRN_MISMATCH' })
  }
  return violations.length === 0 ? Effect.void : Effect.fail(new ValidationFailed({ violations }))
}

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
