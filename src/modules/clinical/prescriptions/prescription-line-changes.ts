import type { Id } from '../../../shared/ids/ids.types.ts'
import { coverageMismatchLineIds } from '../fees/coverage-category-band.ts'
import type { CoverageContext } from '../fees/coverage-category-band.ts'
import { lineAmount } from './prescription-line.ts'
import type { Dose, PrescriptionLine } from './prescription-line.ts'

/**
 * 고칠 처방 라인입니다. `id`가 있으면 그 라인을 통째로 바꾸고, 없으면 새 라인을 뒤에 더합니다. 금액은 서버가 계산하므로
 * 받지 않습니다.
 */
export interface PrescriptionLineUpsert {
  id?: Id<'prescriptionLine'>
  /**
   * 새 라인에 클라이언트가 붙인 임시 이름입니다. 응답의 `prescriptionLineRefs`가 서버 ID와 이어 줍니다. `id`가 있는
   * 라인에서는 이을 것이 없어 보지 않습니다.
   */
  clientRef?: string
  kind: PrescriptionLine['kind']
  feeCode: string | null
  categoryCode: string
  name: string
  dose: Dose
  unitPrice: number
  /** 빠지면 `false`입니다. */
  prn?: boolean
}

export interface PrescriptionLineChanges {
  upsert?: ReadonlyArray<PrescriptionLineUpsert>
  remove?: ReadonlyArray<Id<'prescriptionLine'>>
}

/** 새 라인의 `clientRef`와 서버가 만든 ID입니다. */
export interface PrescriptionLineRef {
  clientRef: string
  id: Id<'prescriptionLine'>
}

/** 처방 라인 변경을 적용할 수 없는 이유입니다. `target`은 라인 ID나 `clientRef`입니다. */
export interface PrescriptionLineChangeError {
  reason: 'PRESCRIPTION_LINE_NOT_FOUND' | 'PRESCRIPTION_LINE_DUPLICATE'
  target: string
}

export type ApplyLineChangesResult =
  | { ok: true; lines: ReadonlyArray<PrescriptionLine>; refs: ReadonlyArray<PrescriptionLineRef> }
  | { ok: false; errors: ReadonlyArray<PrescriptionLineChangeError> }

/**
 * 처방 라인에 `PATCH` 변경을 적용합니다. 지우기(`remove`)를 먼저 하고 고치기(`upsert`)를 합니다. 고친 라인은 자리와
 * ID를 지키고, 새 라인은 뒤에 붙습니다. 금액은 모든 고친·새 라인에서 다시 계산합니다.
 *
 * 없는 라인 ID와, 한 요청 안에서 같은 ID나 같은 `clientRef`를 둘 보내기는 거절하고 이유를 모두 돌려줍니다. 같은 수가코드의
 * 라인은 여럿 둘 수 있습니다(부위가 다른 침술 등).
 */
export function applyLineChanges(
  current: ReadonlyArray<PrescriptionLine>,
  changes: PrescriptionLineChanges,
  newLineId: () => Id<'prescriptionLine'>,
): ApplyLineChangesResult {
  const errors: PrescriptionLineChangeError[] = []
  const known = new Set(current.map((each) => each.id))
  const removed = new Set(changes.remove ?? [])
  for (const id of removed) if (!known.has(id)) errors.push({ reason: 'PRESCRIPTION_LINE_NOT_FOUND', target: id })

  let lines = current.filter((each) => !removed.has(each.id))
  const refs: PrescriptionLineRef[] = []
  const sentIds = new Set<string>()
  const sentRefs = new Set<string>()
  for (const item of changes.upsert ?? []) {
    const duplicate =
      item.id !== undefined && sentIds.has(item.id)
        ? item.id
        : item.id === undefined && item.clientRef !== undefined && sentRefs.has(item.clientRef)
          ? item.clientRef
          : undefined
    if (duplicate !== undefined) {
      errors.push({ reason: 'PRESCRIPTION_LINE_DUPLICATE', target: duplicate })
      continue
    }
    if (item.id !== undefined) sentIds.add(item.id)
    if (item.id === undefined && item.clientRef !== undefined) sentRefs.add(item.clientRef)

    if (item.id !== undefined) {
      const id = item.id
      if (!lines.some((each) => each.id === id)) {
        errors.push({ reason: 'PRESCRIPTION_LINE_NOT_FOUND', target: id })
        continue
      }
      lines = lines.map((each) => (each.id === id ? toLine(id, item) : each))
      continue
    }
    const line = toLine(newLineId(), item)
    lines = [...lines, line]
    if (item.clientRef !== undefined) refs.push({ clientRef: item.clientRef, id: line.id })
  }
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, lines, refs }
}

function toLine(id: Id<'prescriptionLine'>, item: PrescriptionLineUpsert): PrescriptionLine {
  return {
    id,
    kind: item.kind,
    feeCode: item.feeCode,
    categoryCode: item.categoryCode,
    name: item.name,
    dose: { perDay: item.dose.perDay, days: item.dose.days },
    unitPrice: item.unitPrice,
    amount: lineAmount(item.unitPrice, item.dose),
    prn: item.prn ?? false,
  }
}

/**
 * 진료의 보험구분에서 쓸 수 없는 처방 라인의 ID입니다 (coverage-category-band). 저장은 막지 않고 경고로 알리고,
 * 완료(#24)가 막습니다.
 */
export function coverageMismatches(
  lines: ReadonlyArray<PrescriptionLine>,
  context: CoverageContext,
): ReadonlyArray<Id<'prescriptionLine'>> {
  const ids = coverageMismatchLineIds(
    lines.map((each) => ({ lineId: each.id, category: each.categoryCode, feeCode: each.feeCode })),
    context,
  )
  return ids as Array<Id<'prescriptionLine'>>
}
