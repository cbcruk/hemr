import { describe, expect, it } from 'vitest'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { applyLineChanges, coverageMismatches } from './prescription-line-changes.ts'
import type { PrescriptionLineUpsert } from './prescription-line-changes.ts'
import type { PrescriptionLine } from './prescription-line.ts'

const pl = (n: number) => `pl_01JBQ00000000000000000000${n}` as Id<'prescriptionLine'>

const acupuncture: PrescriptionLineUpsert = {
  kind: 'ACUPUNCTURE',
  feeCode: '40011',
  categoryCode: '33001001',
  name: '침술',
  dose: { perDay: 1, days: 1 },
  unitPrice: 4_210,
}
const line = (n: number, overrides: Partial<PrescriptionLine> = {}): PrescriptionLine => ({
  id: pl(n),
  kind: 'ACUPUNCTURE',
  feeCode: '40011',
  categoryCode: '33001001',
  name: '침술',
  dose: { perDay: 1, days: 1 },
  unitPrice: 4_210,
  amount: 4_210,
  prn: false,
  ...overrides,
})

/** 새 라인 ID를 `pl_new1`부터 차례로 만듭니다. */
const ids = () => {
  let next = 1
  return () => `pl_new${next++}` as Id<'prescriptionLine'>
}

describe('applyLineChanges', () => {
  it('appends new lines with computed amounts and maps each clientRef to the new ID', () => {
    const result = applyLineChanges(
      [line(1)],
      {
        upsert: [
          { ...acupuncture, clientRef: 'temp1', dose: { perDay: 2, days: 1 } },
          {
            ...acupuncture,
            kind: 'HERBAL',
            feeCode: null,
            name: '첩약',
            unitPrice: 12_345,
            dose: { perDay: 0.5, days: 3 },
          },
        ],
      },
      ids(),
    )

    expect(result).toEqual({
      ok: true,
      lines: [
        line(1),
        line(0, { id: 'pl_new1' as Id<'prescriptionLine'>, dose: { perDay: 2, days: 1 }, amount: 8_420 }),
        line(0, {
          id: 'pl_new2' as Id<'prescriptionLine'>,
          kind: 'HERBAL',
          feeCode: null,
          name: '첩약',
          unitPrice: 12_345,
          dose: { perDay: 0.5, days: 3 },
          amount: 18_518,
        }),
      ],
      refs: [{ clientRef: 'temp1', id: 'pl_new1' }],
    })
  })

  it('removes first, then replaces a line by ID in place and recomputes its amount', () => {
    const result = applyLineChanges(
      [line(1), line(2), line(3)],
      { remove: [pl(1)], upsert: [{ ...acupuncture, id: pl(3), unitPrice: 5_000, prn: true }] },
      ids(),
    )

    expect(result).toEqual({
      ok: true,
      lines: [line(2), line(3, { unitPrice: 5_000, amount: 5_000, prn: true })],
      refs: [],
    })
  })

  it('ignores a clientRef on a line that already has an ID', () => {
    const result = applyLineChanges(
      [line(1)],
      {
        upsert: [
          { ...acupuncture, id: pl(1), clientRef: 'temp1' },
          { ...acupuncture, clientRef: 'temp1' },
        ],
      },
      ids(),
    )

    expect(result).toMatchObject({ ok: true, refs: [{ clientRef: 'temp1', id: 'pl_new1' }] })
  })

  it('keeps several lines with the same fee code', () => {
    const result = applyLineChanges([line(1)], { upsert: [acupuncture] }, ids())

    expect(result).toMatchObject({ ok: true, lines: [{ id: pl(1) }, { id: 'pl_new1', feeCode: '40011' }] })
  })

  it('rejects unknown and removed IDs and a line sent twice, with every reason', () => {
    const result = applyLineChanges(
      [line(1), line(2)],
      {
        remove: [pl(7), pl(2)],
        upsert: [
          { ...acupuncture, id: pl(8) },
          { ...acupuncture, id: pl(2) },
          { ...acupuncture, id: pl(1) },
          { ...acupuncture, id: pl(1) },
          { ...acupuncture, clientRef: 'temp1' },
          { ...acupuncture, clientRef: 'temp1' },
        ],
      },
      ids(),
    )

    expect(result).toEqual({
      ok: false,
      errors: [
        { reason: 'PRESCRIPTION_LINE_NOT_FOUND', target: pl(7) },
        { reason: 'PRESCRIPTION_LINE_NOT_FOUND', target: pl(8) },
        { reason: 'PRESCRIPTION_LINE_NOT_FOUND', target: pl(2) },
        { reason: 'PRESCRIPTION_LINE_DUPLICATE', target: pl(1) },
        { reason: 'PRESCRIPTION_LINE_DUPLICATE', target: 'temp1' },
      ],
    })
  })
})

describe('coverageMismatches', () => {
  it('finds lines of a category reserved for another coverage', () => {
    const lines = [line(1), line(2, { categoryCode: '73001001' }), line(3, { feeCode: '40721' })]
    const context = { herbalPilot: false, telemedicinePilot: false }

    expect(coverageMismatches(lines, { ...context, coverage: 'NHIS' })).toEqual([pl(2)])
    expect(coverageMismatches(lines, { ...context, coverage: 'AUTO_INSURANCE' })).toEqual([pl(3)])
  })
})
