import { describe, expect, it } from 'vitest'
import {
  initialHiraApprovalStatus,
  pilotHerbalApprovalViolation,
  pilotHerbalLineRejection,
} from './pilot-herbal-approval.ts'
import type { HiraApprovalStatus } from './pilot-herbal-approval.ts'
import { pilotHerbalClaimIssues } from './pilot-herbal-claim-checks.ts'

const line = (lineId: string, status: HiraApprovalStatus | null, category = '35001001') => ({
  lineId,
  category,
  hiraApproval: status === null ? null : { status },
})

describe('첩약 미승인 위반 (pilotHerbalApprovalViolation)', () => {
  it('제출 전·거부·승인 상태 없는 첩약 줄을 모두 모읍니다', () => {
    const lines = [line('a', 'APPROVED'), line('b', 'PENDING'), line('c', 'REJECTED'), line('d', null)]
    expect(pilotHerbalApprovalViolation(lines)).toEqual({
      code: 'PILOT_HERBAL_NOT_APPROVED',
      lineIds: ['b', 'c', 'd'],
      blocksCompletion: true,
    })
  })

  it('첩약 줄의 NOT_REQUIRED는 승인되지 않은 것으로 봅니다', () => {
    expect(pilotHerbalApprovalViolation([line('a', 'NOT_REQUIRED')])?.lineIds).toEqual(['a'])
  })

  it('줄이 없으면 위반이 없습니다', () => {
    expect(pilotHerbalApprovalViolation([])).toBeNull()
  })

  it('같은 줄에 대해 청구 검사 C0005와 같은 줄을 가리킵니다 (결정 3·5)', () => {
    const lines = [
      line('a', 'APPROVED'),
      line('b', 'PENDING'),
      line('c', 'REJECTED'),
      line('d', null),
      line('e', 'NOT_REQUIRED'),
    ]
    const issues = pilotHerbalClaimIssues({
      encounterId: 'cur',
      coverage: 'NHIS',
      pilotHerbal: { diseaseCode: '01' },
      serviceAt: { date: '2026-01-15', time: '10:00' },
      lines: lines.map((each) => ({ ...each, feeCode: null, name: '', herbalDetails: null })),
      diagnoses: [{ code: 'N944', kind: 'PRIMARY' }],
      others: [],
      patientRrn: null,
      doctorRrn: null,
    })
    expect(issues).toEqual([{ code: 'C0005', lineIds: pilotHerbalApprovalViolation(lines)!.lineIds }])
  })

  it('첩약이 아닌 시범사업 카테고리는 승인되지 않아도 보지 않습니다', () => {
    expect(pilotHerbalApprovalViolation([line('a', 'PENDING', '35002001'), line('b', null, '35003001')])).toBeNull()
  })
})

describe('처음 승인 상태 (initialHiraApprovalStatus)', () => {
  it('첩약 줄은 PENDING, 나머지는 NOT_REQUIRED로 시작합니다', () => {
    expect(initialHiraApprovalStatus('35001001')).toBe('PENDING')
    expect(initialHiraApprovalStatus('35002001')).toBe('NOT_REQUIRED')
    expect(initialHiraApprovalStatus('31001001')).toBe('NOT_REQUIRED')
  })
})

describe('시범사업 줄 거부 (pilotHerbalLineRejection)', () => {
  it('EMR 제품이 없는 테넌트는 시범사업 카테고리 줄을 모두 거부합니다', () => {
    expect(pilotHerbalLineRejection('35003001', ['SOO'])).toBe('PILOT_HERBAL_NOT_AVAILABLE')
    expect(pilotHerbalLineRejection('35001001', ['SOO', 'EMR'])).toBeNull()
    expect(pilotHerbalLineRejection('31001001', ['SOO'])).toBeNull()
    for (const category of ['35001002', '35002001', '35004001']) {
      expect(pilotHerbalLineRejection(category, ['SOO'])).toBe('PILOT_HERBAL_NOT_AVAILABLE')
    }
    // EMR이 없으면 SOO가 아닌 조합도 거부합니다
    expect(pilotHerbalLineRejection('35001001', [])).toBe('PILOT_HERBAL_NOT_AVAILABLE')
    expect(pilotHerbalLineRejection('35001001', ['SOO', 'CRM'])).toBe('PILOT_HERBAL_NOT_AVAILABLE')
  })
})
