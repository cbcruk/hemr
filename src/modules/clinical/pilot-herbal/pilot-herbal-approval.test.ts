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

describe('pilotHerbalApprovalViolation', () => {
  it('collects every pending, rejected or missing herbal line', () => {
    const lines = [line('a', 'APPROVED'), line('b', 'PENDING'), line('c', 'REJECTED'), line('d', null)]
    expect(pilotHerbalApprovalViolation(lines)).toEqual({
      code: 'PILOT_HERBAL_NOT_APPROVED',
      lineIds: ['b', 'c', 'd'],
      blocksCompletion: true,
    })
  })

  it('treats NOT_REQUIRED on a herbal line as not approved', () => {
    expect(pilotHerbalApprovalViolation([line('a', 'NOT_REQUIRED')])?.lineIds).toEqual(['a'])
  })

  it('passes an empty list', () => {
    expect(pilotHerbalApprovalViolation([])).toBeNull()
  })

  it('agrees with the C0005 claim check on the same lines (결정 3·5)', () => {
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

  it('ignores other pilot categories even when not approved', () => {
    expect(pilotHerbalApprovalViolation([line('a', 'PENDING', '35002001'), line('b', null, '35003001')])).toBeNull()
  })
})

describe('initialHiraApprovalStatus', () => {
  it('starts herbal lines as pending and others as not required', () => {
    expect(initialHiraApprovalStatus('35001001')).toBe('PENDING')
    expect(initialHiraApprovalStatus('35002001')).toBe('NOT_REQUIRED')
    expect(initialHiraApprovalStatus('31001001')).toBe('NOT_REQUIRED')
  })
})

describe('pilotHerbalLineRejection', () => {
  it('rejects every pilot category for tenants without EMR', () => {
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
