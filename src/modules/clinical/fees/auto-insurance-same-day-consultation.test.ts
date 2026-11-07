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

describe('자보 1일 2차 판정 (autoInsuranceSecondVisits)', () => {
  it('1차가 아니고 지정이 없는 진료를 모두 2차로 지정하고 사용자가 해제한 진료는 그대로 둡니다', () => {
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

  it('진료 시각이 같은 분이면 ID보다 생성 시각으로 순서를 정합니다', () => {
    const result = autoInsuranceSecondVisits({
      current: encounter('r1', '10:00', { createdAt: '2026-11-01T01:05:00Z' }),
      others: [encounter('r9', '10:00', { accidentNumber: 'B', createdAt: '2026-11-01T01:00:00Z' })],
    })
    expect(result.primaryEncounterId).toBe('r9')
    expect(result.currentIsSecondVisit).toBe(true)
  })

  it('일부 진료에만 생성 시각이 있어도 어느 진료가 현재든 같은 1차를 고릅니다', () => {
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

  it('모든 진료가 2차로 지정되면 1차가 없고 자동 지정도 없습니다', () => {
    const result = autoInsuranceSecondVisits({
      current: encounter('r2', '14:00', { accidentNumber: 'B', secondVisit: true }),
      others: [encounter('r1', '09:00', { secondVisit: true })],
    })
    expect(result.primaryEncounterId).toBeNull()
    expect(result.designations).toEqual([])
  })

  it('현재 진료가 자보가 아니면 2차 판정과 J0014를 하지 않습니다', () => {
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

describe('같은 사고 진찰료 중복 (judgeSameAccidentDuplicate)', () => {
  it('뒤 진료에만 경고하고 10 대역 코드를 모두 진찰료로 셉니다', () => {
    const first = encounter('r1', '09:00', { lines: [{ lineId: 'x', feeCode: '10400' }], paid: true })
    const later = encounter('r2', '14:00')
    expect(judgeSameAccidentDuplicate({ current: later, others: [first] }).warnings).toEqual([
      { code: 'DUPLICATE_CONSULTATION_FEE', conflictingEncounterIds: ['r1'], paidEncounterIds: ['r1'] },
    ])
    expect(judgeSameAccidentDuplicate({ current: first, others: [later] }).warnings).toEqual([])
  })

  it('다른 사고 진료는 세지 않고 확인하고 넘긴 중복은 통과시킵니다', () => {
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
