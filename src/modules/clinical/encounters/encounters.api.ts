import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import { Access } from '../../identity/auth/access.ts'
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

/** 진료기록 본문 최대 길이입니다. 편집기 HTML을 담을 만큼 넉넉하게 둡니다. */
const NOTE_MAX_LENGTH = 200_000

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
})

/**
 * 진료 조회와 초안 저장입니다. 조회는 `encounter:read`, 저장은 면허 권한 `encounter:write`가 필요합니다.
 *
 * 저장은 `If-Match`가 필수입니다. 여러 진료실 단말이나 한의사가 함께 고칠 때 마지막 저장이 이기지 않게 합니다. 빠지면 400입니다.
 * 처방 라인(`prescriptionLines`)처럼 아직 받지 않는 필드는 조용히 버리지 않고 400으로 알립니다.
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
        Schema.Struct({ encounter: Encounter, warnings: Schema.Array(EncounterWarning) }),
        { etag: Schema.String },
      ),
      error: [EncounterNotFound, EncounterNotEditable, EncounterVisitCanceled, EncounterChangeInvalid, VersionMismatch],
    })
      .annotate(Access, Access.requires('encounter:write'))
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
  )
  .middleware(Authorization) {}
