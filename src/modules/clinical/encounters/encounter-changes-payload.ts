import { Schema } from 'effect'
import { Dose, PrescriptionKind, PrescriptionLineId, UnitPrice } from '../prescriptions/prescription-line.ts'
import { ClinicalNote, DiagnosisCode, DiagnosisId, DiagnosisKind } from './encounter.ts'

/** 진료기록 본문 최대 길이입니다. 편집기 HTML을 담을 만큼 넉넉하게 둡니다. */
const NOTE_MAX_LENGTH = 200_000

/** 한 요청에서 고치거나 지울 수 있는 처방 라인 수입니다. */
const LINES_MAX = 100

// 이 진료에 있는지는 서비스가 봅니다(`PRESCRIPTION_LINE_NOT_FOUND`)
const PrescriptionLineUpsert = Schema.Struct({
  id: Schema.optionalKey(PrescriptionLineId),
  clientRef: Schema.optionalKey(
    Schema.NonEmptyString.check(Schema.isMaxLength(64)).annotate({
      description: '새 라인에 붙이는 클라이언트 참조입니다. 응답의 `prescriptionLineRefs`가 서버 ID와 잇습니다.',
    }),
  ),
  kind: PrescriptionKind,
  feeCode: Schema.NullOr(Schema.String.check(Schema.isPattern(/^[0-9A-Z]{1,16}$/))).annotate({
    description: '수가코드입니다. 영문 대문자·숫자 1–16자이고, 비급여처럼 코드가 없으면 `null`입니다.',
  }),
  categoryCode: Schema.String.check(Schema.isPattern(/^\d{8}$/)).annotate({
    description: '처방 카테고리 숫자 8자리입니다.',
  }),
  name: Schema.NonEmptyString.check(Schema.isMaxLength(200)),
  dose: Dose,
  unitPrice: UnitPrice,
  prn: Schema.optionalKey(Schema.Boolean.annotate({ description: '빠지면 `false`입니다.' })),
}).annotate({
  description:
    '처방 라인 하나입니다. `id`가 있으면 그 라인을 통째로 바꾸고, 없으면 새 라인을 뒤에 더합니다. 금액은 서버가 계산하므로 받지 않습니다.',
})

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
}).annotate({
  identifier: 'EncounterChangesPayload',
  description:
    '진료 변경 본문입니다. 초안 저장(`PATCH`), 정정(`:amend`), 정정 제안이 씁니다. 빠진 필드는 그대로 두고, 상병·처방 라인은 `upsert`로 더하거나 고치고 `remove`로 지웁니다. 지우기를 먼저 합니다. 상병 `upsert`는 `id`가 없으면 같은 상병코드의 상병을 고치고(구분만 바뀜), 그것도 없으면 더합니다.',
})

export const PrescriptionLineRefs = Schema.Array(
  Schema.Struct({ clientRef: Schema.String, id: PrescriptionLineId }),
).annotate({
  identifier: 'PrescriptionLineRefs',
  description: '요청의 `clientRef`와 서버가 만든 처방 라인 ID의 대응입니다.',
})
