import type { Id } from '../../../shared/ids/ids.types.ts'
import { applyLineChanges, coverageMismatches } from '../prescriptions/prescription-line-changes.ts'
import type { PrescriptionLineChanges, PrescriptionLineRef } from '../prescriptions/prescription-line-changes.ts'
import type { PrescriptionLine } from '../prescriptions/prescription-line.ts'
import type { ClinicalNote, Diagnosis, Encounter, EncounterChangeError, EncounterWarning } from './encounter.ts'

/** 고칠 상병입니다. `id`가 있으면 그 상병을, 없으면 같은 코드의 상병을 고치고 그런 상병이 없으면 더합니다. */
export interface DiagnosisUpsert {
  id?: Id<'diagnosis'>
  code: string
  kind: Diagnosis['kind']
}

/** 진료 `PATCH` 본문입니다. 빠진 필드는 그대로 둡니다. */
export interface EncounterChanges {
  /** 본문을 통째로 바꿉니다. */
  note?: ClinicalNote
  diagnoses?: {
    upsert?: ReadonlyArray<DiagnosisUpsert>
    remove?: ReadonlyArray<Id<'diagnosis'>>
  }
  prescriptionLines?: PrescriptionLineChanges
}

/** 고칠 수 있는 진료 내용입니다. */
export interface EncounterContent {
  note: ClinicalNote
  diagnoses: ReadonlyArray<Diagnosis>
  prescriptionLines: ReadonlyArray<PrescriptionLine>
}

/** 새 상병·처방 라인의 ID를 만듭니다. */
export interface NewIds {
  diagnosis: () => Id<'diagnosis'>
  prescriptionLine: () => Id<'prescriptionLine'>
}

export type ApplyChangesResult =
  | {
      ok: true
      content: EncounterContent
      /** 실제로 바뀐 필드입니다. 비어 있으면 저장하지 않습니다. */
      changed: ReadonlyArray<keyof EncounterContent>
      /** 새 처방 라인의 `clientRef`와 서버 ID입니다. */
      prescriptionLineRefs: ReadonlyArray<PrescriptionLineRef>
    }
  | { ok: false; errors: ReadonlyArray<EncounterChangeError> }

/**
 * 진료 내용에 `PATCH` 변경을 적용합니다. 지우기(`remove`)를 먼저 하고 고치기(`upsert`)를 합니다. 새 상병은 뒤에 붙고,
 * 고친 상병은 자리와 ID를 지킵니다.
 *
 * 없는 상병 ID, 한 요청 안에서 같은 코드나 같은 ID를 둘 보내기, 고친 결과 같은 코드가 둘이 되기는 모두 거절하고 이유를 모두
 * 돌려줍니다. 처방 라인은 `applyLineChanges`가 같은 방식으로 적용하고, 두 쪽의 이유를 함께 돌려줍니다. 주상병 개수처럼
 * 완료 전에만 맞으면 되는 것은 거절하지 않고 `encounterWarnings`로 알립니다.
 */
export function applyChanges(current: EncounterContent, changes: EncounterChanges, ids: NewIds): ApplyChangesResult {
  const errors: EncounterChangeError[] = []
  const known = new Set(current.diagnoses.map((each) => each.id))
  const removed = new Set(changes.diagnoses?.remove ?? [])
  for (const id of removed) if (!known.has(id)) errors.push({ reason: 'DIAGNOSIS_NOT_FOUND', target: id })

  let diagnoses = current.diagnoses.filter((each) => !removed.has(each.id))
  const sent = new Set<string>()
  const sentIds = new Set<string>()
  for (const item of changes.diagnoses?.upsert ?? []) {
    if (sent.has(item.code) || (item.id !== undefined && sentIds.has(item.id))) {
      errors.push({ reason: 'DIAGNOSIS_DUPLICATE', target: sent.has(item.code) ? item.code : item.id! })
      continue
    }
    sent.add(item.code)
    if (item.id !== undefined) sentIds.add(item.id)
    if (item.id !== undefined) {
      if (!diagnoses.some((each) => each.id === item.id)) {
        errors.push({ reason: 'DIAGNOSIS_NOT_FOUND', target: item.id })
        continue
      }
      diagnoses = diagnoses.map((each) => (each.id === item.id ? { ...each, code: item.code, kind: item.kind } : each))
      continue
    }
    const same = diagnoses.find((each) => each.code === item.code)
    diagnoses =
      same === undefined
        ? [...diagnoses, { id: ids.diagnosis(), code: item.code, kind: item.kind }]
        : diagnoses.map((each) => (each.id === same.id ? { ...each, kind: item.kind } : each))
  }
  // ID로 고친 상병이 다른 상병의 코드를 가져간 경우입니다
  const codes = new Set<string>()
  const reported = new Set(errors.filter((each) => each.reason === 'DIAGNOSIS_DUPLICATE').map((each) => each.target))
  for (const each of diagnoses) {
    if (codes.has(each.code) && !reported.has(each.code)) {
      errors.push({ reason: 'DIAGNOSIS_DUPLICATE', target: each.code })
      reported.add(each.code)
    }
    codes.add(each.code)
  }
  const lines = applyLineChanges(current.prescriptionLines, changes.prescriptionLines ?? {}, ids.prescriptionLine)
  if (!lines.ok) errors.push(...lines.errors)
  if (errors.length > 0 || !lines.ok) return { ok: false, errors }

  const note = changes.note ?? current.note
  const changed: Array<keyof EncounterContent> = []
  if (note.body !== current.note.body) changed.push('note')
  if (JSON.stringify(diagnoses) !== JSON.stringify(current.diagnoses)) changed.push('diagnoses')
  if (JSON.stringify(lines.lines) !== JSON.stringify(current.prescriptionLines)) changed.push('prescriptionLines')
  return {
    ok: true,
    content: { note, diagnoses, prescriptionLines: lines.lines },
    changed,
    prescriptionLineRefs: lines.refs,
  }
}

/**
 * 저장은 되지만 완료 전에 고쳐야 하는 것입니다. 상병 문제(`diagnosisWarnings`) 다음에 진료의 보험구분에서 쓸 수 없는
 * 처방 라인(`COVERAGE_CATEGORY_MISMATCH`)입니다.
 *
 * 내원에 아직 첩약·비대면 시범사업 표시가 없어 둘 다 아닌 진료로 봅니다. 그 카테고리·코드의 라인은 늘 경고입니다.
 */
export function encounterWarnings(
  encounter: Pick<Encounter, 'coverage' | 'diagnoses' | 'prescriptionLines'>,
): EncounterWarning[] {
  const warnings = diagnosisWarnings(encounter.diagnoses)
  const mismatched = coverageMismatches(encounter.prescriptionLines, {
    coverage: encounter.coverage,
    herbalPilot: false,
    telemedicinePilot: false,
  })
  if (mismatched.length > 0) {
    warnings.push({
      code: 'COVERAGE_CATEGORY_MISMATCH',
      message: 'Some prescription lines cannot be used with the coverage of the encounter.',
      targets: mismatched,
    })
  }
  return warnings
}

/** 저장은 되지만 완료 전에 고쳐야 하는 상병 문제입니다. 상병이 없으면 아직 쓰는 중이라 알리지 않습니다. */
export function diagnosisWarnings(diagnoses: ReadonlyArray<Diagnosis>): EncounterWarning[] {
  if (diagnoses.length === 0) return []
  const primaries = diagnoses.filter((each) => each.kind === 'PRIMARY').length
  if (primaries === 0) return [{ code: 'PRIMARY_DIAGNOSIS_MISSING', message: 'Choose one primary diagnosis.' }]
  if (primaries > 1) return [{ code: 'PRIMARY_DIAGNOSIS_MULTIPLE', message: 'Only one primary diagnosis is allowed.' }]
  return []
}
