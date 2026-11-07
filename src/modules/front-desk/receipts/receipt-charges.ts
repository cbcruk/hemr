import { createHash } from 'node:crypto'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { Encounter } from '../../clinical/encounters/encounter.ts'
import { hasClinicalContent } from '../../clinical/encounters/encounter-draft.ts'
import type { PrescriptionLine } from '../../clinical/prescriptions/prescription-line.ts'
import type { EncounterDue } from './checkout-settlement.types.ts'
import { type CopayBasis, insuredCopay } from './insured-copay.ts'
import type { ReceiptCharges } from './receipt.ts'

/** 급여 본인부담 계산에 쓰는 내원·환자 정보입니다. */
export interface DueContext {
  basis: CopayBasis
  /** 진료일 기준 만 나이입니다. 생년월일이 없으면 `null`입니다. */
  age: number | null
}

/** 비급여로 받는 처방 종류입니다. 수가코드가 없는 라인도 비급여입니다. */
const NONBENEFIT_KINDS: ReadonlySet<PrescriptionLine['kind']> = new Set([
  'NONBENEFIT',
  'HERBAL',
  'PACKAGE_SALE',
  'PACKAGE_USE',
])

/** 일반 부담률을 따르는 급여 처방 종류입니다. 추나·첩약 시범·방문진료처럼 따로 매기는 종류는 아직 계산하지 않습니다. */
const GENERAL_KINDS: ReadonlySet<PrescriptionLine['kind']> = new Set([
  'CONSULTATION',
  'ACUPUNCTURE',
  'MOXIBUSTION',
  'CUPPING',
  'PHARMACOPUNCTURE',
  'INSURED_MEDICINE',
])

/**
 * 진료 하나의 받을 금액입니다. 계산할 수 없으면 `null`입니다.
 *
 * - 일반(`SELF_PAY`) 진료는 처방 라인 금액의 합이 모두 비과세 비급여입니다
 * - 건보·의료급여 진료는 급여 라인의 합으로 급여 본인부담(`insuredCopay`)을 계산하고 비급여 라인을 더합니다.
 *   진찰료도 처방 라인이라 라인에 없으면 받지 않습니다. 본인부담 근거를 정할 수 없거나, 따로
 *   매기는 급여 라인(추나·첩약 시범 등)이 있거나, 급여 라인이 있는데 나이를 모르면 `null`입니다
 * - 자보·산재 진료는 처방이나 본문·상병이 있으면 `null`이고, 아무것도 쓰지 않았으면 0원입니다
 *
 * 처방 라인에 과세 여부가 아직 없어 모두 비과세로 봅니다. 한의원 진료는 대부분 부가가치세 면세이고, 과세 비급여(미용
 * 목적 등)는 비급여 항목 설정이 생길 때 라인에 표시를 더합니다.
 */
export function encounterDue(encounter: Encounter, context: DueContext): EncounterDue | null {
  const due = (copay: number, nonbenefit: number): EncounterDue => ({
    encounterId: encounter.id,
    due: { taxable: 0, taxExempt: copay + nonbenefit },
    insuredCopay: copay,
    jejuSubsidy: 0,
  })
  const sum = (lines: ReadonlyArray<PrescriptionLine>) => lines.reduce((total, line) => total + line.amount, 0)

  if (encounter.coverage === 'SELF_PAY') return due(0, sum(encounter.prescriptionLines))
  if (encounter.coverage !== 'NHIS' && encounter.coverage !== 'MEDICAL_AID') {
    return encounter.prescriptionLines.length > 0 || hasClinicalContent(encounter) ? null : due(0, 0)
  }

  const nonbenefit = encounter.prescriptionLines.filter(
    (line) => line.feeCode === null || NONBENEFIT_KINDS.has(line.kind),
  )
  const insured = encounter.prescriptionLines.filter((line) => !nonbenefit.includes(line))
  if (insured.length === 0) return due(0, sum(nonbenefit))
  const { basis, age } = context
  if (basis.kind === 'UNSUPPORTED' || age === null || insured.some((line) => !GENERAL_KINDS.has(line.kind))) {
    return null
  }
  const { copay } = insuredCopay({
    basis,
    age,
    pregnant: encounter.benefitFlags.pregnant,
    dispensed: insured.some((line) => line.kind === 'INSURED_MEDICINE'),
    amount: sum(insured),
  })
  return due(copay, sum(nonbenefit))
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
