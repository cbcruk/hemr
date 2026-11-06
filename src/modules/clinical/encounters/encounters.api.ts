import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import { Access } from '../../identity/auth/access.ts'
import { PermissionDenied } from '../../identity/auth/auth-errors.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import { PatientId, PatientNotFound } from '../../patients/patient.ts'
import {
  ClinicalNote,
  DiagnosisCode,
  DiagnosisId,
  DiagnosisKind,
  Encounter,
  EncounterChangeInvalid,
  EncounterId,
  EncounterNotEditable,
  EncounterNotFound,
  EncounterVisitCanceled,
  EncounterWarning,
} from './encounter.ts'
import { Dose, PrescriptionKind, PrescriptionLineId, UnitPrice } from '../prescriptions/prescription-line.ts'

/** 진료기록 본문 최대 길이입니다. 편집기 HTML을 담을 만큼 넉넉하게 둡니다. */
const NOTE_MAX_LENGTH = 200_000

/** 한 요청에서 고치거나 지울 수 있는 처방 라인 수입니다. */
const LINES_MAX = 100

/** 처방 라인 하나입니다. 금액은 서버가 계산하므로 받지 않습니다. */
const PrescriptionLineUpsert = Schema.Struct({
  id: Schema.optionalKey(PrescriptionLineId),
  clientRef: Schema.optionalKey(Schema.NonEmptyString.check(Schema.isMaxLength(64))),
  kind: PrescriptionKind,
  feeCode: Schema.NullOr(Schema.String.check(Schema.isPattern(/^[0-9A-Z]{1,16}$/))),
  categoryCode: Schema.String.check(Schema.isPattern(/^\d{8}$/)),
  name: Schema.NonEmptyString.check(Schema.isMaxLength(200)),
  dose: Dose,
  unitPrice: UnitPrice,
  prn: Schema.optionalKey(Schema.Boolean),
})

/** 진료 초안 저장 본문입니다 (clinical.md 저장). 빠진 필드는 그대로 둡니다. */
const UpdatePayload = Schema.Struct({
  note: Schema.optionalKey(
    Schema.Struct({ body: ClinicalNote.fields.body.check(Schema.isMaxLength(NOTE_MAX_LENGTH)) }),
  ),
  diagnoses: Schema.optionalKey(
    Schema.Struct({
      upsert: Schema.optionalKey(
        Schema.Array(
          Schema.Struct({ id: Schema.optionalKey(DiagnosisId), code: DiagnosisCode, kind: DiagnosisKind }),
        ).check(Schema.isMaxLength(50)),
      ),
      remove: Schema.optionalKey(Schema.Array(DiagnosisId).check(Schema.isMaxLength(50))),
    }),
  ),
  prescriptionLines: Schema.optionalKey(
    Schema.Struct({
      upsert: Schema.optionalKey(Schema.Array(PrescriptionLineUpsert).check(Schema.isMaxLength(LINES_MAX))),
      remove: Schema.optionalKey(Schema.Array(PrescriptionLineId).check(Schema.isMaxLength(LINES_MAX))),
    }),
  ),
})

/**
 * 진료 조회와 초안 저장입니다. 조회는 `encounter:read`, 저장은 면허 권한 `encounter:write`가 필요합니다. 처방 라인을
 * 보내면 `prescription:write`(PRN 라인은 `prescription:write_prn`도)가 더 필요합니다.
 *
 * 저장은 `If-Match`가 필수입니다. 여러 진료실 단말이나 한의사가 함께 고칠 때 마지막 저장이 이기지 않게 합니다. 빠지면 400입니다.
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
          /** 새 처방 라인의 `clientRef`와 서버가 만든 ID입니다. */
          prescriptionLineRefs: Schema.Array(Schema.Struct({ clientRef: Schema.String, id: PrescriptionLineId })),
        }),
        { etag: Schema.String },
      ),
      error: [
        EncounterNotFound,
        EncounterNotEditable,
        EncounterVisitCanceled,
        EncounterChangeInvalid,
        VersionMismatch,
        PermissionDenied,
      ],
    })
      .annotate(Access, Access.requires('encounter:write'))
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
  )
  .middleware(Authorization) {}
