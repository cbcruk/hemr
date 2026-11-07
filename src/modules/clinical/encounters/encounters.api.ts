import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import { Access } from '../../identity/auth/access.ts'
import { PermissionDenied } from '../../identity/auth/auth-errors.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import { PatientId, PatientNotFound } from '../../patients/patient.ts'
import { Visit } from '../../front-desk/visits/visit.ts'
import {
  Encounter,
  EncounterBilled,
  EncounterChangeInvalid,
  EncounterCompletionRejected,
  EncounterId,
  EncounterLocked,
  EncounterNotEditable,
  EncounterNotFound,
  EncounterRevision,
  EncounterRevisionNotFound,
  EncounterVisitCanceled,
  EncounterWarning,
} from './encounter.ts'
import { PrescriptionLineRefs, EncounterChangesPayload as UpdatePayload } from './encounter-changes-payload.ts'

/** 진료 완료 본문입니다 (clinical.md 완료 커맨드). */
const CompletePayload = Schema.Struct({
  /** 완료한 뒤 내원을 보낼 상태입니다. 없으면 `IN_TREATMENT`(치료실로 보냄)입니다. */
  nextVisitStatus: Schema.optionalKey(Schema.Literals(['WAITING', 'IN_TREATMENT', 'AWAITING_PAYMENT'])),
  /** 확인하고 넘길 위반입니다. */
  acknowledge: Schema.optionalKey(
    Schema.Array(Schema.Literals(['DUPLICATE_CONSULTATION_FEE'])).check(Schema.isMaxLength(10)),
  ),
})

/** 정정·철회 사유입니다. */
const Reason = Schema.NonEmptyString.check(Schema.isMaxLength(500))

/** 정정 본문입니다. `changes`는 `PATCH` 본문과 같습니다. */
const AmendPayload = Schema.Struct({
  reason: Reason,
  changes: UpdatePayload,
  acknowledge: CompletePayload.fields.acknowledge,
})

/** 새 처방 라인의 `clientRef`와 서버가 만든 ID입니다. */

const lockEndpoint = (name: 'lock' | 'unlock') =>
  HttpApiEndpoint.post(name, `/encounters/:id::${name}`, {
    params: { id: EncounterId },
    headers: { 'if-match': Schema.String },
    success: HttpApiSchema.WithHeaders(Encounter, { etag: Schema.String }),
    error: [EncounterNotFound, EncounterNotEditable, VersionMismatch],
  }).annotate(Access, Access.requires('encounter:amend'))

/**
 * 진료 조회, 초안 저장, 완료, 정정·철회·고정, 판 조회입니다. 조회는 `encounter:read`, 저장은 면허 권한 `encounter:write`가 필요합니다. 처방 라인을
 * 보내면 `prescription:write`(PRN 라인은 `prescription:write_prn`도)가 더 필요합니다.
 *
 * 완료(`:complete`)도 면허 권한 `encounter:write`이고, 내원을 옮기는 권한(`visit:update`)은 따로 보지 않습니다.
 *
 * 정정(`:amend`)과 고정(`:lock`·`:unlock`)은 면허 권한 `encounter:amend`, 철회(`:retract`)는 `encounter:retract`입니다.
 * 판(`/versions`)은 `encounter:read`로 엽니다.
 *
 * 저장·완료·정정·철회·고정은 `If-Match`가 필수입니다. 여러 진료실 단말이나 한의사가 함께 고칠 때 마지막 저장이 이기지 않게 합니다. 빠지면 400입니다.
 * 활력징후처럼 아직 받지 않는 필드는 조용히 버리지 않고 400으로 알립니다.
 */
export class EncountersApi extends HttpApiGroup.make('encounters')
  .add(
    HttpApiEndpoint.get('get', '/encounters/:id', {
      params: { id: EncounterId },
      success: HttpApiSchema.WithHeaders(Encounter, { etag: Schema.String }),
      error: EncounterNotFound,
    }).annotate(Access, Access.requires('encounter:read')),
    HttpApiEndpoint.get('listForPatient', '/patients/:id/encounters', {
      params: { id: PatientId },
      success: Schema.Struct({ items: Schema.Array(Encounter) }),
      error: PatientNotFound,
    }).annotate(Access, Access.requires('encounter:read')),
    HttpApiEndpoint.patch('update', '/encounters/:id', {
      params: { id: EncounterId },
      headers: { 'if-match': Schema.String },
      payload: UpdatePayload,
      success: HttpApiSchema.WithHeaders(
        Schema.Struct({
          encounter: Encounter,
          warnings: Schema.Array(EncounterWarning),
          prescriptionLineRefs: PrescriptionLineRefs,
        }),
        { etag: Schema.String },
      ),
      error: [
        EncounterNotFound,
        EncounterNotEditable,
        EncounterBilled,
        EncounterVisitCanceled,
        EncounterChangeInvalid,
        VersionMismatch,
        PermissionDenied,
      ],
    })
      .annotate(Access, Access.requires('encounter:write'))
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
    HttpApiEndpoint.post('complete', '/encounters/:id::complete', {
      params: { id: EncounterId },
      headers: { 'if-match': Schema.String },
      payload: CompletePayload,
      success: HttpApiSchema.WithHeaders(Schema.Struct({ encounter: Encounter, visit: Schema.NullOr(Visit) }), {
        etag: Schema.String,
      }),
      error: [
        EncounterNotFound,
        EncounterNotEditable,
        EncounterVisitCanceled,
        EncounterCompletionRejected,
        VersionMismatch,
      ],
    })
      .annotate(Access, Access.requires('encounter:write'))
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
    HttpApiEndpoint.post('amend', '/encounters/:id::amend', {
      params: { id: EncounterId },
      headers: { 'if-match': Schema.String },
      payload: AmendPayload,
      success: HttpApiSchema.WithHeaders(
        Schema.Struct({ encounter: Encounter, prescriptionLineRefs: PrescriptionLineRefs }),
        { etag: Schema.String },
      ),
      error: [
        EncounterNotFound,
        EncounterNotEditable,
        EncounterLocked,
        EncounterBilled,
        EncounterVisitCanceled,
        EncounterChangeInvalid,
        EncounterCompletionRejected,
        VersionMismatch,
        PermissionDenied,
      ],
    })
      .annotate(Access, Access.requires('encounter:amend'))
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
    HttpApiEndpoint.post('retract', '/encounters/:id::retract', {
      params: { id: EncounterId },
      headers: { 'if-match': Schema.String },
      payload: Schema.Struct({ reason: Reason }),
      success: HttpApiSchema.WithHeaders(Encounter, { etag: Schema.String }),
      error: [EncounterNotFound, EncounterNotEditable, EncounterLocked, EncounterBilled, VersionMismatch],
    })
      .annotate(Access, Access.requires('encounter:retract'))
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
    lockEndpoint('lock'),
    lockEndpoint('unlock'),
    HttpApiEndpoint.get('listRevisions', '/encounters/:id/versions', {
      params: { id: EncounterId },
      success: Schema.Struct({ items: Schema.Array(EncounterRevision) }),
      error: EncounterNotFound,
    }).annotate(Access, Access.requires('encounter:read')),
    HttpApiEndpoint.get('getRevision', '/encounters/:id/versions/:n', {
      params: { id: EncounterId, n: Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)) },
      success: EncounterRevision,
      error: [EncounterNotFound, EncounterRevisionNotFound],
    }).annotate(Access, Access.requires('encounter:read')),
  )
  .middleware(Authorization) {}
