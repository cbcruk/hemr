import type { Id } from '../../../shared/ids/ids.types.ts'
import type { ClinicalNote, Diagnosis, EncounterChangeError, EncounterWarning } from './encounter.ts'

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
}

/** 고칠 수 있는 진료 내용입니다. */
export interface EncounterContent {
  note: ClinicalNote
  diagnoses: ReadonlyArray<Diagnosis>
}

export type ApplyChangesResult =
  | {
      ok: true
      content: EncounterContent
      /** 실제로 바뀐 필드입니다. 비어 있으면 저장하지 않습니다. */
      changed: ReadonlyArray<keyof EncounterContent>
    }
  | { ok: false; errors: ReadonlyArray<EncounterChangeError> }

/**
 * 진료 내용에 `PATCH` 변경을 적용합니다. 지우기(`remove`)를 먼저 하고 고치기(`upsert`)를 합니다. 새 상병은 뒤에 붙고,
 * 고친 상병은 자리와 ID를 지킵니다.
 *
 * 없는 상병 ID, 한 요청 안에서 같은 코드나 같은 ID를 둘 보내기, 고친 결과 같은 코드가 둘이 되기는 모두 거절하고 이유를 모두
 * 돌려줍니다. 주상병 개수처럼 완료 전에만 맞으면 되는 것은 거절하지 않고 `diagnosisWarnings`로 알립니다.
 *
 * `newDiagnosisId`는 새 상병의 ID를 만듭니다.
 */
export function applyChanges(
  current: EncounterContent,
  changes: EncounterChanges,
  newDiagnosisId: () => Id<'diagnosis'>,
): ApplyChangesResult {
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
        ? [...diagnoses, { id: newDiagnosisId(), code: item.code, kind: item.kind }]
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
  if (errors.length > 0) return { ok: false, errors }

  const note = changes.note ?? current.note
  const changed: Array<keyof EncounterContent> = []
  if (note.body !== current.note.body) changed.push('note')
  if (JSON.stringify(diagnoses) !== JSON.stringify(current.diagnoses)) changed.push('diagnoses')
  return { ok: true, content: { note, diagnoses }, changed }
}

/** 저장은 되지만 완료 전에 고쳐야 하는 상병 문제입니다. 상병이 없으면 아직 쓰는 중이라 알리지 않습니다. */
export function diagnosisWarnings(diagnoses: ReadonlyArray<Diagnosis>): EncounterWarning[] {
  if (diagnoses.length === 0) return []
  const primaries = diagnoses.filter((each) => each.kind === 'PRIMARY').length
  if (primaries === 0) return [{ code: 'PRIMARY_DIAGNOSIS_MISSING', message: 'Choose one primary diagnosis.' }]
  if (primaries > 1) return [{ code: 'PRIMARY_DIAGNOSIS_MULTIPLE', message: 'Only one primary diagnosis is allowed.' }]
  return []
}
