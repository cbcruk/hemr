import { describe, expect, it } from 'vitest'
import { lineAmount, procedureFeeCode, procedureFeeLines } from './procedure-fee-modifiers.ts'
import type { PrescriptionFeeLine, ProcedureContext } from './procedure-fee-modifiers.ts'

const CHILD: ProcedureContext = {
  serviceAt: { date: '2026-03-04', time: '10:00' },
  birthDate: '2023-01-01',
  ageSurcharge: true,
}

const ACUPUNCTURE: PrescriptionFeeLine = {
  feeCode: '40011',
  category: '33001001',
  name: '경혈침술',
  unitPrice: 1000,
  amount: 1000,
  dailyDose: 1,
  days: 1,
}

const MASTER = new Map([
  ['40011', { name: '경혈침술', unitPrice: 1000 }],
  ['40011600', { name: '경혈침술-1~6세', claimName: '', unitPrice: 1600 }],
])

describe('procedureFeeCode', () => {
  it('ignores a birth date after the service date', () => {
    expect(procedureFeeCode(ACUPUNCTURE, { ...CHILD, birthDate: '2026-03-10' })).toBeNull()
  })

  it('keeps a user-specified 8-digit code', () => {
    expect(procedureFeeCode({ ...ACUPUNCTURE, feeCode: '40011300' }, CHILD)).toBeNull()
  })

  it('returns null when a computed code is already current', () => {
    expect(procedureFeeCode({ ...ACUPUNCTURE, feeCode: '40011600', feeCodeComputed: true }, CHILD)).toBeNull()
  })

  it('adds a time digit only to codes in the surcharge table', () => {
    const night = { timeSurcharge: 'NIGHT' } as const
    expect(procedureFeeCode({ ...ACUPUNCTURE, ...night }, CHILD)).toBe('40011610')
    expect(procedureFeeCode({ feeCode: '20010', category: '32001001', ...night }, CHILD)).toBeNull()
  })

  it('leaves consultation codes to consultation-fee-code even when marked computed', () => {
    const consultation = { feeCode: '10100100', category: '31001001', feeCodeComputed: true }
    expect(procedureFeeCode(consultation, CHILD)).toBeNull()
    expect(procedureFeeCode({ feeCode: '10100', category: '31001001', timeSurcharge: 'NIGHT' }, CHILD)).toBeNull()
  })

  it('reverts a computed code when the age surcharge setting is off', () => {
    const computed = { ...ACUPUNCTURE, feeCode: '40011600', feeCodeComputed: true }
    expect(procedureFeeCode(computed, { ...CHILD, ageSurcharge: false })).toBe('40011')
  })

  it('adds no method digit outside 경혈침술', () => {
    expect(procedureFeeCode({ feeCode: '40030', category: '33001003', acupunctureMethod: 'WARMING' }, CHILD)).toBe(
      '40030600',
    )
  })
})

describe('procedureFeeLines', () => {
  it('marks a replaced line as computed and uses the plain name when the claim name is empty', () => {
    const { lines } = procedureFeeLines({ ...CHILD, lines: [ACUPUNCTURE], feeMaster: MASTER })
    expect(lines).toEqual([
      {
        ...ACUPUNCTURE,
        feeCode: '40011600',
        feeCodeComputed: true,
        name: '경혈침술-1~6세',
        unitPrice: 1600,
        amount: 1600,
      },
    ])
  })

  it('reverts a computed code to the base code once the modifier no longer applies', () => {
    const computed = { ...ACUPUNCTURE, feeCode: '40011600', feeCodeComputed: true, unitPrice: 1600, amount: 1600 }
    const { lines } = procedureFeeLines({ ...CHILD, birthDate: '1990-01-01', lines: [computed], feeMaster: MASTER })
    expect(lines).toEqual([{ ...ACUPUNCTURE, feeCodeComputed: false }])
  })

  it('reports each missing code once', () => {
    const master = new Map()
    const result = procedureFeeLines({ ...CHILD, lines: [ACUPUNCTURE, { ...ACUPUNCTURE, days: 2 }], feeMaster: master })
    expect(result.lines).toEqual([ACUPUNCTURE, { ...ACUPUNCTURE, days: 2 }])
    expect(result.warnings).toEqual([{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: ['40011600'] }])
  })

  it('keeps a computed code for telemedicine as the current client does', () => {
    const computed = { ...ACUPUNCTURE, feeCode: '40011600', feeCodeComputed: true }
    const result = procedureFeeLines({
      ...CHILD,
      birthDate: '1990-01-01',
      lines: [computed],
      feeMaster: MASTER,
      telemedicine: true,
    })
    expect(result.lines).toEqual([computed])
  })

  it('keeps extra line fields in the result type', () => {
    const { lines } = procedureFeeLines({ ...CHILD, lines: [{ ...ACUPUNCTURE, id: 'a' }], feeMaster: MASTER })
    expect(lines[0]?.id).toBe('a')
  })

  it('leaves lines alone for telemedicine', () => {
    const result = procedureFeeLines({ ...CHILD, lines: [ACUPUNCTURE], feeMaster: MASTER, telemedicine: true })
    expect(result).toEqual({ lines: [ACUPUNCTURE], warnings: [] })
  })
})

describe('lineAmount', () => {
  it('rounds once with half up and no float error', () => {
    expect(lineAmount(650, 2, 3)).toBe(3900)
    expect(lineAmount(333, 0.5, 3)).toBe(500)
    expect(lineAmount(1001, 0.1, 3)).toBe(300)
  })

  it('rejects a negative or fractional price', () => {
    expect(() => lineAmount(-1, 1, 1)).toThrow(RangeError)
    expect(() => lineAmount(1.5, 1, 1)).toThrow(RangeError)
    expect(() => lineAmount(100, 0.1234567, 1)).toThrow(RangeError)
  })
})
