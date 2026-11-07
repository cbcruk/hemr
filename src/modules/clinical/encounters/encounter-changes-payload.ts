import { Schema } from 'effect'
import { Dose, PrescriptionKind, PrescriptionLineId, UnitPrice } from '../prescriptions/prescription-line.ts'
import { ClinicalNote, DiagnosisCode, DiagnosisId, DiagnosisKind } from './encounter.ts'

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

/** 진료 변경 본문입니다 (clinical.md 저장). 초안 저장(`PATCH`), 정정(`:amend`), 정정 제안이 씁니다. 빠진 필드는 그대로 둡니다. */
export const EncounterChangesPayload = Schema.Struct({
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

/** 요청의 `clientRef`와 서버가 만든 처방 라인 ID의 대응입니다. */
export const PrescriptionLineRefs = Schema.Array(Schema.Struct({ clientRef: Schema.String, id: PrescriptionLineId }))
