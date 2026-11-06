import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api'
import { ValidationFailed, VersionMismatch } from '../../shared/problem/problem.ts'
import { Access } from '../identity/auth/access.ts'
import { Authorization } from '../identity/auth/authorization.ts'
import {
  Address,
  ChartNumberInput,
  ChartNumberTaken,
  Consent,
  ConsentLockedByPatient,
  ConsentPurpose,
  ConsentStatus,
  Contact,
  DuplicateRrn,
  LocalDate,
  Patient,
  PatientId,
  PatientNotFound,
  RrnInput,
  Sex,
} from './patient.ts'

const params = { id: PatientId }
/** 공백만 있는 값은 받지 않습니다. */
const Text = (max: number) => Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(max))
const withEtag = HttpApiSchema.WithHeaders(Patient, { etag: Schema.String })

const RegisterPayload = Schema.Struct({
  name: Text(50),
  chartNumber: Schema.optionalKey(ChartNumberInput),
  rrn: Schema.optionalKey(RrnInput),
  birthDate: Schema.optionalKey(LocalDate),
  isLunarBirthday: Schema.optionalKey(Schema.Boolean),
  sex: Schema.optionalKey(Sex),
  contacts: Schema.optionalKey(Schema.Array(Contact).check(Schema.isMaxLength(10))),
  addresses: Schema.optionalKey(Schema.Array(Address).check(Schema.isMaxLength(5))),
  notes: Schema.optionalKey(Text(2000)),
})

const UpdatePayload = Schema.Struct({
  name: Schema.optionalKey(Text(50)),
  chartNumber: Schema.optionalKey(ChartNumberInput),
  rrn: Schema.optionalKey(Schema.NullOr(RrnInput)),
  birthDate: Schema.optionalKey(Schema.NullOr(LocalDate)),
  isLunarBirthday: Schema.optionalKey(Schema.Boolean),
  sex: Schema.optionalKey(Schema.NullOr(Sex)),
  contacts: Schema.optionalKey(Schema.Array(Contact).check(Schema.isMaxLength(10))),
  addresses: Schema.optionalKey(Schema.Array(Address).check(Schema.isMaxLength(5))),
  notes: Schema.optionalKey(Schema.NullOr(Text(2000))),
})

/**
 * 환자 등록·조회·수정과 동의입니다 (patients.md 엔드포인트).
 *
 * 주민등록번호 원문 조회는 `X-Access-Reason` 헤더가 필수이고 열람 기록을 남깁니다. 헤더는 ASCII만 실을 수 있어, 한글
 * 사유는 `encodeURIComponent`로 인코딩해 보냅니다.
 */
export class PatientsApi extends HttpApiGroup.make('patients')
  .add(
    HttpApiEndpoint.get('search', '/patients', {
      query: {
        /** 이름 일부, 초성, 차트번호 앞부분, 전화번호 뒷자리입니다. */
        q: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(50))),
        limit: Schema.optionalKey(
          Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 200 })),
        ),
        cursor: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(500))),
      },
      success: Schema.Struct({ items: Schema.Array(Patient), nextCursor: Schema.NullOr(Schema.String) }),
      error: ValidationFailed,
    }).annotate(Access, Access.requires('patient:read')),
    HttpApiEndpoint.post('register', '/patients', {
      payload: RegisterPayload,
      success: withEtag.pipe(HttpApiSchema.status(201)),
      error: [ChartNumberTaken, DuplicateRrn, ValidationFailed],
    }).annotate(Access, Access.requires('patient:create')),
    /** 지금 등록하면 받을 차트번호입니다. 보여 주기만 하고 잡아 두지 않습니다. */
    HttpApiEndpoint.get('nextChartNumber', '/patients::next-chart-number', {
      success: Schema.Struct({ chartNumber: Schema.String }),
    }).annotate(Access, Access.requires('patient:create')),
    HttpApiEndpoint.get('get', '/patients/:id', { params, success: withEtag, error: PatientNotFound }).annotate(
      Access,
      Access.requires('patient:read'),
    ),
    HttpApiEndpoint.patch('update', '/patients/:id', {
      params,
      headers: { 'if-match': Schema.optionalKey(Schema.String) },
      payload: UpdatePayload,
      success: withEtag,
      error: [PatientNotFound, VersionMismatch, ChartNumberTaken, DuplicateRrn, ValidationFailed],
    }).annotate(Access, Access.requires('patient:update')),
    HttpApiEndpoint.get('revealRrn', '/patients/:id/rrn', {
      params,
      headers: { 'x-access-reason': Schema.String.check(Schema.isMaxLength(600)) },
      success: Schema.Struct({ rrn: Schema.NullOr(Schema.String) }),
      error: [PatientNotFound, ValidationFailed],
    }).annotate(Access, Access.requires('patient.rrn:read')),
    HttpApiEndpoint.get('consents', '/patients/:id/consents', {
      params,
      success: Schema.Array(Consent),
      error: PatientNotFound,
    }).annotate(Access, Access.requires('patient:read')),
    HttpApiEndpoint.get('consentHistory', '/patients/:id/consents/history', {
      params,
      success: Schema.Array(Consent),
      error: PatientNotFound,
    }).annotate(Access, Access.requires('patient:read')),
    /** 기록을 하나 더합니다. 덮어쓰지 않습니다. */
    HttpApiEndpoint.post('recordConsent', '/patients/:id/consents', {
      params,
      payload: Schema.Struct({
        purpose: ConsentPurpose,
        status: ConsentStatus,
        evidenceDocumentId: Schema.optionalKey(Text(64)),
      }),
      success: Consent.pipe(HttpApiSchema.status(201)),
      error: [PatientNotFound, ConsentLockedByPatient],
    }).annotate(Access, Access.requires('patient:update')),
  )
  .middleware(Authorization) {}
