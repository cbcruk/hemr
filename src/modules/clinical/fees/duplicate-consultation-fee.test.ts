import { describe, expect, it } from 'vitest'
import { judgeDuplicateConsultationFee, telemedicineDuplicateIssues } from './duplicate-consultation-fee.ts'
import type { ConsultationEncounter } from './duplicate-consultation-fee.ts'

function encounter(encounterId: string, overrides: Partial<ConsultationEncounter> = {}): ConsultationEncounter {
  return {
    encounterId,
    serviceAt: { date: '2026-11-01', time: '09:00' },
    telemedicine: false,
    feeCodes: ['10200'],
    paid: false,
    ...overrides,
  }
}

const CURRENT = { ...encounter('cur'), serviceAt: { date: '2026-11-01', time: '14:00' } }

describe('judgeDuplicateConsultationFee', () => {
  it('lists every conflicting encounter and skips ones without a service time or consultation fee', () => {
    const result = judgeDuplicateConsultationFee({
      coverage: 'NHIS',
      current: { ...CURRENT, paid: true },
      others: [
        encounter('a'),
        encounter('b', { telemedicine: true, paid: true }),
        encounter('c', { serviceAt: null }),
        encounter('d', { feeCodes: ['91001', '40011'] }),
        encounter('cur'),
      ],
    })
    expect(result).toEqual({
      warnings: [
        { code: 'DUPLICATE_CONSULTATION_FEE', conflictingEncounterIds: ['a', 'b'], paidEncounterIds: ['cur', 'b'] },
      ],
      acknowledged: [],
      accepted: false,
    })
  })

  it('moves an acknowledged duplicate out of warnings', () => {
    const result = judgeDuplicateConsultationFee({
      coverage: 'MEDICAL_AID',
      current: CURRENT,
      others: [encounter('a')],
      acknowledge: ['DUPLICATE_CONSULTATION_FEE'],
    })
    expect(result.warnings).toEqual([])
    expect(result.acknowledged.map((violation) => violation.conflictingEncounterIds)).toEqual([['a']])
    expect(result.accepted).toBe(true)
  })

  it('does not check self-pay encounters', () => {
    const result = judgeDuplicateConsultationFee({ coverage: 'SELF_PAY', current: CURRENT, others: [encounter('a')] })
    expect(result).toEqual({ warnings: [], acknowledged: [], accepted: true })
  })
})

describe('telemedicineDuplicateIssues', () => {
  it('needs a same-day face-to-face encounter with a consultation fee', () => {
    const lines = [{ lineId: 'f1', feeCode: '10200', category: '31001001' }]
    const current = { ...CURRENT, telemedicine: true }
    expect(telemedicineDuplicateIssues({ current, lines, others: [encounter('a')] })).toEqual([
      { code: 'T0004', lineIds: ['f1'] },
    ])
    const otherDay = encounter('b', { serviceAt: { date: '2026-10-31', time: '23:59' } })
    expect(telemedicineDuplicateIssues({ current, lines, others: [otherDay] })).toEqual([])
    expect(telemedicineDuplicateIssues({ current, lines, others: [encounter('c', { telemedicine: true })] })).toEqual(
      [],
    )
  })

  it('skips management fees and lines outside the consultation category', () => {
    const issues = telemedicineDuplicateIssues({
      current: { ...CURRENT, telemedicine: true },
      others: [encounter('a')],
      lines: [
        { lineId: 'm1', feeCode: '91001', category: '31001001' },
        { lineId: 'x1', feeCode: '10200', category: '33001001' },
      ],
    })
    expect(issues).toEqual([])
  })
})
