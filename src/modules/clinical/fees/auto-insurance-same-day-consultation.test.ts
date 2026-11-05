import { describe, expect, it } from 'vitest'
import {
  autoInsuranceClaimIssues,
  autoInsuranceSecondVisits,
  judgeSameAccidentDuplicate,
} from './auto-insurance-same-day-consultation.ts'
import type { AutoInsuranceEncounter } from './auto-insurance-same-day-consultation.ts'
import type { ServiceAt } from './consultation-fee-code.ts'

function encounter(
  encounterId: string,
  time: string,
  overrides: Partial<Omit<AutoInsuranceEncounter, 'serviceAt'>> = {},
): AutoInsuranceEncounter & { serviceAt: ServiceAt } {
  return {
    encounterId,
    coverage: 'AUTO_INSURANCE',
    serviceAt: { date: '2026-11-01', time },
    accidentNumber: 'A',
    secondVisit: null,
    lines: [{ lineId: `${encounterId}-f`, feeCode: '10200' }],
    paid: false,
    ...overrides,
  }
}

describe('autoInsuranceSecondVisits', () => {
  it('designates every unset non-primary encounter and keeps one the user cleared', () => {
    const result = autoInsuranceSecondVisits({
      current: encounter('r3', '15:00', { accidentNumber: 'C' }),
      others: [
        encounter('r1', '09:00'),
        encounter('r2', '11:00', { accidentNumber: 'B', secondVisit: false }),
        encounter('r4', '16:00', { accidentNumber: 'B' }),
      ],
    })
    expect(result).toEqual({
      multipleAccidents: true,
      primaryEncounterId: 'r1',
      currentIsSecondVisit: true,
      designations: [
        { encounterId: 'r3', removedLineIds: ['r3-f'] },
        { encounterId: 'r4', removedLineIds: ['r4-f'] },
      ],
    })
  })

  it('orders a same-minute tie by creation time before ID', () => {
    const result = autoInsuranceSecondVisits({
      current: encounter('r1', '10:00', { createdAt: '2026-11-01T01:05:00Z' }),
      others: [encounter('r9', '10:00', { accidentNumber: 'B', createdAt: '2026-11-01T01:00:00Z' })],
    })
    expect(result.primaryEncounterId).toBe('r9')
    expect(result.currentIsSecondVisit).toBe(true)
  })

  it('picks the same primary whichever encounter is current when only some have a creation time', () => {
    const a = encounter('z', '10:00', { createdAt: '2026-11-01T01:00:00Z' })
    const b = encounter('m', '10:00', { accidentNumber: 'B' })
    const c = encounter('a', '10:00', { accidentNumber: 'C', createdAt: '2026-11-01T02:00:00Z' })
    const primaries = [a, b, c].map(
      (current) =>
        autoInsuranceSecondVisits({ current, others: [a, b, c].filter((other) => other !== current) })
          .primaryEncounterId,
    )
    expect(primaries).toEqual(['m', 'm', 'm'])
  })

  it('has no primary when every encounter is flagged', () => {
    const result = autoInsuranceSecondVisits({
      current: encounter('r2', '14:00', { accidentNumber: 'B', secondVisit: true }),
      others: [encounter('r1', '09:00', { secondVisit: true })],
    })
    expect(result.primaryEncounterId).toBeNull()
    expect(result.designations).toEqual([])
  })

  it('skips a current encounter that is not auto insurance', () => {
    const result = autoInsuranceSecondVisits({
      current: encounter('r2', '14:00', { coverage: 'NHIS', accidentNumber: 'B' }),
      others: [encounter('r1', '09:00')],
    })
    expect(result.multipleAccidents).toBe(false)
    expect(autoInsuranceClaimIssues({ current: encounter('r2', '14:00', { coverage: 'NHIS' }), others: [] })).toEqual(
      [],
    )
  })
})

describe('judgeSameAccidentDuplicate', () => {
  it('warns only the later encounter and counts every 10-band code', () => {
    const first = encounter('r1', '09:00', { lines: [{ lineId: 'x', feeCode: '10400' }], paid: true })
    const later = encounter('r2', '14:00')
    expect(judgeSameAccidentDuplicate({ current: later, others: [first] }).warnings).toEqual([
      { code: 'DUPLICATE_CONSULTATION_FEE', conflictingEncounterIds: ['r1'], paidEncounterIds: ['r1'] },
    ])
    expect(judgeSameAccidentDuplicate({ current: first, others: [later] }).warnings).toEqual([])
  })

  it('ignores other accidents and accepts an acknowledged duplicate', () => {
    const current = encounter('r2', '14:00')
    expect(
      judgeSameAccidentDuplicate({ current, others: [encounter('r1', '09:00', { accidentNumber: 'B' })] }).warnings,
    ).toEqual([])
    const acknowledged = judgeSameAccidentDuplicate({
      current,
      others: [encounter('r1', '09:00')],
      acknowledge: ['DUPLICATE_CONSULTATION_FEE'],
    })
    expect(acknowledged.accepted).toBe(true)
    expect(acknowledged.acknowledged).toHaveLength(1)
  })
})
