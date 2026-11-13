import { Result } from 'effect'
import { domainEvent, eventContext } from '../../shared/events/domain-event.ts'
import type { DecisionContext, DomainEvent } from '../../shared/events/domain-event.ts'
import type { Id } from '../../shared/ids/ids.types.ts'
import { ValidationFailed, VersionMismatch } from '../../shared/problem/problem.ts'
import { ConsentLockedByPatient } from './patient.ts'
import type { Address, Consent, Contact, Patient, PatientRecord } from './patient.ts'
import type { ConsentRecord, NewPatientRecord } from './patient-repository.ts'
import { birthDateOf, sexOf } from './rrn.ts'

/**
 * 환자 애그리거트입니다 (docs/design/domain-model.md, patients.md). 등록·수정과 동의 기록을 판정합니다. 판정 함수는
 * 순수 함수입니다. 주민등록번호의 암호화·복호화는 비밀키를 쓰므로 서비스가 하고, 판정은 원문 숫자와 저장할 값
 * (`SealedRrn`)을 받습니다.
 */

/** 주민등록번호를 저장할 세 값(암호문·색인·가린 번호)입니다. 번호가 없으면 모두 `null`입니다. */
export interface SealedRrn {
  rrnSealed: PatientRecord['rrnSealed']
  rrnIndex: PatientRecord['rrnIndex']
  rrnMasked: PatientRecord['rrnMasked']
}

/** 환자 등록 입력입니다. `chartNumber`를 비우면 저장소가 채번합니다. */
export interface RegisterCommand {
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

/**
 * 등록을 판정합니다. 이름은 앞뒤 공백을 지우고, 주민등록번호가 있으면 비어 있는 생년월일·성별을 번호에서 채웁니다.
 * 스키마로 못 보는 규칙(`validate`)을 어기면 400 `VALIDATION_FAILED`입니다. 차트 번호는 저장소가 채번하므로
 * `patient.created`는 저장한 기록으로 만듭니다(`events`).
 */
export function decideRegister(
  input: RegisterCommand,
  id: Id<'patient'>,
  rrn: { digits: string | null; sealed: SealedRrn },
  context: DecisionContext,
): Result.Result<
  { record: NewPatientRecord; events: (saved: PatientRecord) => ReadonlyArray<DomainEvent> },
  ValidationFailed
> {
  const { digits } = rrn
  const record: NewPatientRecord = {
    id,
    tenantId: context.tenantId,
    chartNumber: input.chartNumber ?? null,
    name: input.name.trim(),
    ...rrn.sealed,
    birthDate: input.birthDate ?? (digits === null ? null : birthDateOf(digits)),
    isLunarBirthday: input.isLunarBirthday ?? false,
    sex: input.sex ?? (digits === null ? null : sexOf(digits)),
    contacts: input.contacts ?? [],
    addresses: input.addresses ?? [],
    notes: input.notes ?? null,
    firstVisitDate: null,
    status: 'ACTIVE',
    createdAt: context.at,
    updatedAt: context.at,
    version: 1,
  }
  const invalid = validate(record, digits)
  if (invalid !== null) return Result.fail(invalid)
  return Result.succeed({
    record,
    events: (saved) => [
      domainEvent(
        'patient.created',
        id,
        context.at,
        { patientId: id, chartNumber: saved.chartNumber },
        eventContext(context),
      ),
    ],
  })
}

/** 바꿀 필드만 보냅니다. `null`은 값을 지웁니다. 컬렉션(`contacts`·`addresses`)은 통째로 바꿉니다. */
export interface UpdateCommand {
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
 * 수정을 판정합니다. `expectedVersion`이 다르면 412 `VERSION_MISMATCH`입니다. 바뀐 필드가 없으면 `null`이고 쓰지
 * 않습니다. 있으면 규칙을 다시 보고 버전을 올려 `patient.updated`(바뀐 필드 이름)를 냅니다.
 *
 * `rrn`은 요청에 번호가 있을 때(`null`로 지우기 포함) 그 숫자와 저장할 값입니다. 생년월일·성별과 맞는지 보려면 바뀌지
 * 않은 번호도 원문이 필요하므로, 바뀐 것이 있을 때만 `currentDigits`로 지금 번호를 엽니다.
 */
export function decideUpdate(
  current: PatientRecord,
  input: UpdateCommand,
  expectedVersion: number | undefined,
  rrn: { digits: string | null; sealed: SealedRrn } | null,
  currentDigits: () => string | null,
  context: DecisionContext,
): Result.Result<{ next: PatientRecord; event: DomainEvent } | null, VersionMismatch | ValidationFailed> {
  if (expectedVersion !== undefined && expectedVersion !== current.version) {
    return Result.fail(new VersionMismatch({ currentVersion: current.version }))
  }
  const { rrn: _, ...fields } = input
  const merged: PatientRecord = {
    ...current,
    ...fields,
    ...(fields.name === undefined ? {} : { name: fields.name.trim() }),
    ...(rrn === null ? {} : rrn.sealed),
  }
  const changed = changedFields(current, merged)
  if (changed.length === 0) return Result.succeed(null)
  const invalid = validate(merged, rrn === null ? currentDigits() : rrn.digits)
  if (invalid !== null) return Result.fail(invalid)
  const next: PatientRecord = { ...merged, updatedAt: context.at, version: current.version + 1 }
  const event = domainEvent(
    'patient.updated',
    current.id,
    context.at,
    { patientId: current.id, fields: changed },
    eventContext(context),
  )
  return Result.succeed({ next, event })
}

/**
 * 직원이 기록하는 동의입니다. 출처는 늘 `DESK`입니다. 태블릿(`TABLET`)은 환자 본인의 기록이라 기기 토큰이 생기면
 * 그 입구에서만 쓰고, 080 거부와 이관(`PATIENT_080`·`IMPORT`)은 연동·이관 작업만 씁니다.
 */
export interface RecordConsentCommand {
  purpose: string
  status: Consent['status']
  evidenceDocumentId?: string
}

/**
 * 동의 기록을 판정합니다. 환자가 080으로 거부한 목적은, 그 뒤에 환자 본인의 동의(`TABLET`·`PATIENT_080`의
 * `GRANTED`)가 없으면 직원이 `GRANTED`로 되돌릴 수 없습니다(409 `CONSENT_LOCKED_BY_PATIENT`). 사이에 다른 상태를 끼워
 * 넣어도 풀리지 않습니다. `history`는 환자의 동의 기록이고, `consent.changed`를 냅니다.
 */
export function decideRecordConsent(
  patientId: Id<'patient'>,
  history: ReadonlyArray<Consent>,
  input: RecordConsentCommand,
  context: DecisionContext,
): Result.Result<{ consent: ConsentRecord; event: DomainEvent }, ConsentLockedByPatient> {
  if (input.status === 'GRANTED' && lockedByPatient(history.filter((each) => each.purpose === input.purpose))) {
    return Result.fail(new ConsentLockedByPatient({ purpose: input.purpose }))
  }
  const consent: ConsentRecord = {
    patientId,
    purpose: input.purpose,
    status: input.status,
    source: 'DESK',
    decidedAt: context.at,
    decidedBy: context.userId,
    evidenceDocumentId: input.evidenceDocumentId ?? null,
  }
  const event = domainEvent(
    'consent.changed',
    patientId,
    context.at,
    { patientId, purpose: input.purpose, status: input.status, source: consent.source },
    eventContext(context),
  )
  return Result.succeed({ consent, event })
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
 * 성별이 번호와 맞아야 합니다. 위반을 모두 모아 400 `VALIDATION_FAILED`로 줍니다. 어긴 것이 없으면 `null`입니다.
 */
function validate(
  record: Pick<PatientRecord, 'contacts' | 'addresses' | 'birthDate' | 'sex'>,
  digits: string | null,
): ValidationFailed | null {
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
  return violations.length === 0 ? null : new ValidationFailed({ violations })
}

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
