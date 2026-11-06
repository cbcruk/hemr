import { describe, expect, it } from 'vitest'
import { isId } from '../../../shared/ids/ids.ts'
import type { Encounter } from '../../clinical/encounters/encounter.ts'
import { chargesOf, encounterDue, quoteIdOf } from './receipt-charges.ts'

const line = (amount: number): Encounter['prescriptionLines'][number] => ({
  id: 'pl_01JBQ000000000000000000001' as Encounter['prescriptionLines'][number]['id'],
  kind: 'NONBENEFIT',
  feeCode: null,
  categoryCode: '90001001',
  name: '약침',
  dose: { perDay: 1, days: 1 },
  unitPrice: amount,
  amount,
  prn: false,
})

const encounter = (overrides: Partial<Encounter>) =>
  ({
    id: 'enc_01JBQ000000000000000000001',
    coverage: 'SELF_PAY',
    note: { body: '' },
    diagnoses: [],
    prescriptionLines: [],
    ...overrides,
  }) as Encounter

describe('encounterDue', () => {
  it('sums self-pay lines as tax-exempt nonbenefit', () => {
    expect(encounterDue(encounter({ prescriptionLines: [line(3_000), line(1_500)] }))).toEqual({
      encounterId: 'enc_01JBQ000000000000000000001',
      due: { taxable: 0, taxExempt: 4_500 },
      insuredCopay: 0,
      jejuSubsidy: 0,
    })
  })

  it('cannot price insured lines yet but lets an empty insured encounter through', () => {
    expect(encounterDue(encounter({ coverage: 'NHIS', prescriptionLines: [line(3_000)] }))).toBeNull()
    expect(encounterDue(encounter({ coverage: 'NHIS' }))?.due).toEqual({ taxable: 0, taxExempt: 0 })
    // 진찰만 한 보험 진료도 진찰료 본인부담이 있어 계산하지 못합니다
    expect(encounterDue(encounter({ coverage: 'NHIS', note: { body: '<p>요통</p>' }, diagnoses: [] }))).toBeNull()
  })
})

describe('chargesOf', () => {
  it('splits tax-exempt dues into insured copay and nonbenefit', () => {
    expect(
      chargesOf([
        { encounterId: 'a', due: { taxable: 1_000, taxExempt: 5_000 }, insuredCopay: 2_000, jejuSubsidy: 0 },
        { encounterId: 'b', due: { taxable: 0, taxExempt: 3_000 }, insuredCopay: 0, jejuSubsidy: 0 },
      ]),
    ).toEqual({ insuredCopay: 2_000, nonbenefit: { taxable: 1_000, taxExempt: 6_000 }, total: 9_000 })
  })
})

describe('quoteIdOf', () => {
  const a = { encounterId: 'enc_a', due: { taxable: 0, taxExempt: 1_000 }, insuredCopay: 0, jejuSubsidy: 0 }
  const b = { encounterId: 'enc_b', due: { taxable: 0, taxExempt: 2_000 }, insuredCopay: 0, jejuSubsidy: 0 }

  it('is a valid quote ID that ignores encounter order', () => {
    expect(isId('quote', quoteIdOf([a, b]))).toBe(true)
    expect(quoteIdOf([a, b])).toBe(quoteIdOf([b, a]))
  })

  it('changes when an amount or the selection changes', () => {
    expect(quoteIdOf([a, { ...b, due: { taxable: 0, taxExempt: 2_001 } }])).not.toBe(quoteIdOf([a, b]))
    expect(quoteIdOf([a])).not.toBe(quoteIdOf([a, b]))
  })
})
