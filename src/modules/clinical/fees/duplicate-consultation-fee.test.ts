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

describe('같은 날 진찰료 중복 (judgeDuplicateConsultationFee)', () => {
  it('충돌 진료를 모두 담고 진료 시각이나 진찰료가 없는 진료는 세지 않습니다', () => {
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

  it('확인하고 넘긴 중복은 경고에서 빼 acknowledged로 옮깁니다', () => {
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

  it('일반 진료는 검사하지 않습니다', () => {
    const result = judgeDuplicateConsultationFee({ coverage: 'SELF_PAY', current: CURRENT, others: [encounter('a')] })
    expect(result).toEqual({ warnings: [], acknowledged: [], accepted: true })
  })
})

describe('비대면 진찰료 중복 청구 이슈 (telemedicineDuplicateIssues)', () => {
  it('같은 날 진찰료가 있는 대면 진료가 있을 때만 T0004를 붙입니다', () => {
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

  it('관리료와 한방진찰료 카테고리 밖의 줄에는 붙이지 않습니다', () => {
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
