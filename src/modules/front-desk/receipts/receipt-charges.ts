import { createHash } from 'node:crypto'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { Encounter } from '../../clinical/encounters/encounter.ts'
import { hasClinicalContent } from '../../clinical/encounters/encounter-draft.ts'
import type { EncounterDue } from './checkout-settlement.types.ts'
import type { ReceiptCharges } from './receipt.ts'

/**
 * 진료 하나의 받을 금액입니다. 지금은 일반(`SELF_PAY`) 진료만 계산합니다. 처방 라인 금액의 합이 모두 비과세
 * 비급여이고, 급여 본인부담과 제주 지원금은 0입니다. 보험 진료는 급여 본인부담을 계산할 수 없어 `null`입니다. 처방이
 * 없어도 본문·상병이 있으면 진찰료 본인부담이 있으므로 `null`이고, 아무것도 쓰지 않은 보험 진료만 0원입니다.
 *
 * 처방 라인에 과세 여부가 아직 없어 모두 비과세로 봅니다. 한의원 진료는 대부분 부가가치세 면세이고, 과세 비급여(미용
 * 목적 등)는 비급여 항목 설정이 생길 때 라인에 표시를 더합니다.
 */
export function encounterDue(encounter: Encounter): EncounterDue | null {
  if (encounter.coverage !== 'SELF_PAY' && (encounter.prescriptionLines.length > 0 || hasClinicalContent(encounter))) {
    return null
  }
  const amount = encounter.prescriptionLines.reduce((sum, line) => sum + line.amount, 0)
  return { encounterId: encounter.id, due: { taxable: 0, taxExempt: amount }, insuredCopay: 0, jejuSubsidy: 0 }
}

/** 받을 금액을 청구 항목으로 나눕니다. 비과세 중 급여 본인부담을 뺀 나머지가 비과세 비급여입니다. */
export function chargesOf(dues: ReadonlyArray<EncounterDue>): ReceiptCharges {
  const insuredCopay = dues.reduce((sum, each) => sum + each.insuredCopay, 0)
  const taxable = dues.reduce((sum, each) => sum + each.due.taxable, 0)
  const taxExempt = dues.reduce((sum, each) => sum + each.due.taxExempt, 0)
  return { insuredCopay, nonbenefit: { taxable, taxExempt: taxExempt - insuredCopay }, total: taxable + taxExempt }
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * 견적 ID입니다. 진료별 받을 금액에서 계산해, 금액이 같으면 같은 ID이고 처방 수정으로 금액이 바뀌면 다른 ID입니다.
 * 견적을 저장하지 않고도 수납이 "견적 뒤 금액이 바뀌었는가"를 판정합니다. 진료 순서와는 상관없습니다.
 */
export function quoteIdOf(dues: ReadonlyArray<EncounterDue>): Id<'quote'> {
  const canonical = [...dues]
    .sort((a, b) => (a.encounterId < b.encounterId ? -1 : a.encounterId > b.encounterId ? 1 : 0))
    .map((each) => [each.encounterId, each.due.taxable, each.due.taxExempt, each.insuredCopay, each.jejuSubsidy])
  const digest = createHash('sha256').update(JSON.stringify(canonical)).digest()
  // ID 형식(ULID 26자, Crockford base32)에 맞춥니다. 첫 글자는 ULID 시각 범위를 넘지 않게 0–7입니다
  const chars = Array.from({ length: 26 }, (_, index) => CROCKFORD[digest[index]! % (index === 0 ? 8 : 32)])
  return `qt_${chars.join('')}` as Id<'quote'>
}
