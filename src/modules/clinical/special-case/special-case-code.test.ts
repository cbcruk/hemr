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

describe('특정기호 위반 (specialCaseMismatch, 결정 1)', () => {
  it('진료 상병 하나가 특정기호의 어느 행에든 맞으면 통과합니다', () => {
    expect(specialCaseMismatch({ claim: CLAIM, diagnosisCodes: ['I10', 'E71.5'], rareDiseases: RARE_DISEASES })).toBe(
      null,
    )
  })

  it('맞는 상병이 없으면 연계상병 불일치입니다', () => {
    expect(specialCaseMismatch({ claim: CLAIM, diagnosisCodes: ['I10'], rareDiseases: RARE_DISEASES })).toEqual({
      code: 'SPECIAL_CASE_CODE_MISMATCH',
      reason: 'LINKED_DIAGNOSIS_MISMATCH',
    })
    expect(specialCaseMismatch({ claim: CLAIM, diagnosisCodes: [], rareDiseases: RARE_DISEASES })?.reason).toBe(
      'LINKED_DIAGNOSIS_MISMATCH',
    )
  })

  it('기준자료에 없는 특정기호는 위반입니다 (결정 4)', () => {
    const claim = { ...CLAIM, specificCode: 'V999' }
    expect(specialCaseMismatch({ claim, diagnosisCodes: ['G12.2'], rareDiseases: RARE_DISEASES })?.reason).toBe(
      'NOT_IN_REFERENCE',
    )
  })

  it('상병 일치보다 형식을 먼저 보고 특정기호를 정규화해 비교합니다', () => {
    const missing = { ...CLAIM, specificCode: '  ' }
    expect(specialCaseMismatch({ claim: missing, diagnosisCodes: [], rareDiseases: [] })?.reason).toBe(
      'SPECIFIC_CODE_MISSING',
    )
    const lower = { ...CLAIM, specificCode: ' v101 ' }
    expect(specialCaseMismatch({ claim: lower, diagnosisCodes: ['G122'], rareDiseases: RARE_DISEASES })).toBeNull()
  })

  it('특정기호를 적지 않아도 되는 진료는 검사하지 않습니다', () => {
    const cancer = { ...CLAIM, specificCode: null, registrationNumber: '01000123' }
    expect(specialCaseMismatch({ claim: cancer, diagnosisCodes: [], rareDiseases: [] })).toBeNull()
    const aid = { ...CLAIM, coverage: 'MEDICAL_AID' as const, specificCode: null }
    expect(specialCaseMismatch({ claim: aid, diagnosisCodes: [], rareDiseases: [] })).toBeNull()
  })
})

describe('연계상병 일치 (matchesLinkedDiagnoses)', () => {
  it('양 끝이 비지 않은 둘이 아닌 범위는 아무것도 맞지 않습니다', () => {
    expect(matchesLinkedDiagnoses('-B99', 'A00')).toBe(false)
    expect(matchesLinkedDiagnoses('A00-', 'A50')).toBe(false)
    expect(matchesLinkedDiagnoses('A00-B99-C00', 'A55')).toBe(false)
  })

  it('항목 앞뒤 공백과 빈 항목은 무시합니다', () => {
    expect(matchesLinkedDiagnoses(' M05 , ,M06 ', 'm06.1')).toBe(true)
    expect(matchesLinkedDiagnoses(',', 'A00')).toBe(false)
  })
})

describe('특정기호 후보 (specialCaseCandidates)', () => {
  it('현행처럼 등록번호와 기준자료 특정기호의 공백을 지우고 비교합니다', () => {
    const result = specialCaseCandidates({
      claim: { ...CLAIM, specificCode: null },
      registrations: [{ specificCode: 'V101', registrationNumber: ' 21000123 ' }],
      rareDiseases: [{ specificCode: ' V101', linkedDiagnoses: 'G12.2', diseaseName: 'synthetic-A' }],
      diagnosisCode: 'G12.2',
    })
    expect(result.candidates).toEqual([{ specificCode: ' V101', diseaseName: 'synthetic-A' }])
  })
})

describe('특정기호 정규화 (normalizeSpecificCode)', () => {
  it('앞뒤 공백을 지우고 대문자로 바꾸며 없으면 null입니다', () => {
    expect(normalizeSpecificCode(' v101 ')).toBe('V101')
    expect(normalizeSpecificCode(null)).toBeNull()
  })
})
