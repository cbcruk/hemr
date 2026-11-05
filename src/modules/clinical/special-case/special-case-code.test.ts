import { describe, expect, it } from 'vitest'
import {
  matchesLinkedDiagnoses,
  normalizeSpecificCode,
  specialCaseCandidates,
  specialCaseMismatch,
} from './special-case-code.ts'
import type { RareDiseaseRow, SpecialCaseClaim } from './special-case-code.ts'

const CLAIM: SpecialCaseClaim = {
  coverage: 'NHIS',
  rareDiseaseSupport: false,
  specificCode: 'V101',
  registrationNumber: '21000123',
}

const RARE_DISEASES: RareDiseaseRow[] = [
  { specificCode: 'V101', linkedDiagnoses: 'G12.2', diseaseName: 'synthetic-A' },
  { specificCode: 'V101', linkedDiagnoses: 'E70-E72', diseaseName: 'synthetic-A2' },
]

describe('specialCaseMismatch (결정 1)', () => {
  it('passes when any diagnosis matches any row of the code', () => {
    expect(specialCaseMismatch({ claim: CLAIM, diagnosisCodes: ['I10', 'E71.5'], rareDiseases: RARE_DISEASES })).toBe(
      null,
    )
  })

  it('reports a diagnosis mismatch when no diagnosis matches', () => {
    expect(specialCaseMismatch({ claim: CLAIM, diagnosisCodes: ['I10'], rareDiseases: RARE_DISEASES })).toEqual({
      code: 'SPECIAL_CASE_CODE_MISMATCH',
      reason: 'LINKED_DIAGNOSIS_MISMATCH',
    })
    expect(specialCaseMismatch({ claim: CLAIM, diagnosisCodes: [], rareDiseases: RARE_DISEASES })?.reason).toBe(
      'LINKED_DIAGNOSIS_MISMATCH',
    )
  })

  it('reports a code missing from the reference data (결정 4)', () => {
    const claim = { ...CLAIM, specificCode: 'V999' }
    expect(specialCaseMismatch({ claim, diagnosisCodes: ['G12.2'], rareDiseases: RARE_DISEASES })?.reason).toBe(
      'NOT_IN_REFERENCE',
    )
  })

  it('reports the format before matching and normalizes the code', () => {
    const missing = { ...CLAIM, specificCode: '  ' }
    expect(specialCaseMismatch({ claim: missing, diagnosisCodes: [], rareDiseases: [] })?.reason).toBe(
      'SPECIFIC_CODE_MISSING',
    )
    const lower = { ...CLAIM, specificCode: ' v101 ' }
    expect(specialCaseMismatch({ claim: lower, diagnosisCodes: ['G122'], rareDiseases: RARE_DISEASES })).toBeNull()
  })

  it('skips encounters that do not need a specific code', () => {
    const cancer = { ...CLAIM, specificCode: null, registrationNumber: '01000123' }
    expect(specialCaseMismatch({ claim: cancer, diagnosisCodes: [], rareDiseases: [] })).toBeNull()
    const aid = { ...CLAIM, coverage: 'MEDICAL_AID' as const, specificCode: null }
    expect(specialCaseMismatch({ claim: aid, diagnosisCodes: [], rareDiseases: [] })).toBeNull()
  })
})

describe('matchesLinkedDiagnoses', () => {
  it('matches nothing for a range without exactly two non-empty ends', () => {
    expect(matchesLinkedDiagnoses('-B99', 'A00')).toBe(false)
    expect(matchesLinkedDiagnoses('A00-', 'A50')).toBe(false)
    expect(matchesLinkedDiagnoses('A00-B99-C00', 'A55')).toBe(false)
  })

  it('ignores spaces around entries and empty entries', () => {
    expect(matchesLinkedDiagnoses(' M05 , ,M06 ', 'm06.1')).toBe(true)
    expect(matchesLinkedDiagnoses(',', 'A00')).toBe(false)
  })
})

describe('specialCaseCandidates', () => {
  it('trims registration numbers and reference codes like the current client', () => {
    const result = specialCaseCandidates({
      claim: { ...CLAIM, specificCode: null },
      registrations: [{ specificCode: 'V101', registrationNumber: ' 21000123 ' }],
      rareDiseases: [{ specificCode: ' V101', linkedDiagnoses: 'G12.2', diseaseName: 'synthetic-A' }],
      diagnosisCode: 'G12.2',
    })
    expect(result.candidates).toEqual([{ specificCode: ' V101', diseaseName: 'synthetic-A' }])
  })
})

describe('normalizeSpecificCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeSpecificCode(' v101 ')).toBe('V101')
    expect(normalizeSpecificCode(null)).toBeNull()
  })
})
