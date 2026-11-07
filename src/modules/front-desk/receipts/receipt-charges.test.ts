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

const insuredLine = (kind: Encounter['prescriptionLines'][number]['kind'], amount: number) => ({
  ...line(amount),
  kind,
  feeCode: '40011',
})

const adult = { basis: { kind: 'NHIS' }, age: 40 } as const

describe('encounterDue', () => {
  it('sums self-pay lines as tax-exempt nonbenefit', () => {
    expect(encounterDue(encounter({ prescriptionLines: [line(3_000), line(1_500)] }), adult)).toEqual({
      encounterId: 'enc_01JBQ000000000000000000001',
      due: { taxable: 0, taxExempt: 4_500 },
      insuredCopay: 0,
      jejuSubsidy: 0,
    })
  })

  it('adds the insured copay to the nonbenefit lines of an insured encounter', () => {
    const due = encounterDue(
      encounter({
        coverage: 'NHIS',
        benefitFlags: { fullSelfPay: false, pregnant: false },
        prescriptionLines: [insuredLine('CONSULTATION', 12_000), insuredLine('ACUPUNCTURE', 4_210), line(10_000)],
      }),
      adult,
    )
    // 급여 16,210 × 30% = 4,863 → 4,800
    expect(due).toMatchObject({ due: { taxable: 0, taxExempt: 14_800 }, insuredCopay: 4_800 })
  })

  it('reads dispensing and pregnancy from the encounter', () => {
    const senior = (lines: Encounter['prescriptionLines'], pregnant = false) =>
      encounterDue(
        encounter({ coverage: 'NHIS', benefitFlags: { fullSelfPay: false, pregnant }, prescriptionLines: lines }),
        { basis: { kind: 'NHIS' }, age: 70 },
      )?.insuredCopay
    expect(senior([insuredLine('CONSULTATION', 22_000)])).toBe(4_400)
    expect(senior([insuredLine('CONSULTATION', 18_000), insuredLine('INSURED_MEDICINE', 4_000)])).toBe(2_200)
    expect(
      encounterDue(
        encounter({
          coverage: 'NHIS',
          benefitFlags: { fullSelfPay: false, pregnant: true },
          prescriptionLines: [insuredLine('CONSULTATION', 20_000)],
        }),
        adult,
      )?.insuredCopay,
    ).toBe(2_000)
  })

  it('treats lines without a fee code and nonbenefit kinds as nonbenefit even on an insured encounter', () => {
    const due = encounterDue(
      encounter({
        coverage: 'NHIS',
        benefitFlags: { fullSelfPay: false, pregnant: false },
        prescriptionLines: [{ ...line(5_000), kind: 'ACUPUNCTURE' }, insuredLine('HERBAL', 30_000)],
      }),
      { basis: { kind: 'UNSUPPORTED' }, age: null },
    )
    expect(due).toMatchObject({ due: { taxExempt: 35_000 }, insuredCopay: 0 })
  })

  it('lets an insured encounter with clinical content but no insured lines through at zero copay', () => {
    expect(
      encounterDue(encounter({ coverage: 'NHIS', note: { body: '<p>요통</p>' } }), {
        basis: { kind: 'UNSUPPORTED' },
        age: null,
      })?.due,
    ).toEqual({ taxable: 0, taxExempt: 0 })
  })

  it('refuses insured lines it cannot price', () => {
    const insured = (lines: Encounter['prescriptionLines'], context: Parameters<typeof encounterDue>[1] = adult) =>
      encounterDue(
        encounter({
          coverage: 'NHIS',
          benefitFlags: { fullSelfPay: false, pregnant: false },
          prescriptionLines: lines,
        }),
        context,
      )
    expect(insured([insuredLine('ACUPUNCTURE', 4_210)], { basis: { kind: 'UNSUPPORTED' }, age: 40 })).toBeNull()
    expect(insured([insuredLine('ACUPUNCTURE', 4_210)], { basis: { kind: 'NHIS' }, age: null })).toBeNull()
    for (const kind of ['CHUNA', 'PILOT_HERBAL', 'HOME_VISIT', 'OTHER'] as const) {
      expect(insured([insuredLine('ACUPUNCTURE', 4_210), insuredLine(kind, 10_000)])).toBeNull()
    }
  })

  it('still refuses auto-insurance and industrial-accident encounters with content', () => {
    expect(encounterDue(encounter({ coverage: 'AUTO_INSURANCE', prescriptionLines: [line(3_000)] }), adult)).toBeNull()
    expect(
      encounterDue(encounter({ coverage: 'INDUSTRIAL_ACCIDENT', note: { body: '<p>요통</p>' } }), adult),
    ).toBeNull()
    expect(encounterDue(encounter({ coverage: 'AUTO_INSURANCE' }), adult)?.due).toEqual({ taxable: 0, taxExempt: 0 })
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
