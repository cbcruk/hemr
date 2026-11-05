import { describe, expect, it } from 'vitest'
import { pilotHerbalClaimIssues } from './pilot-herbal-claim-checks.ts'
import type { PilotHerbalClaimInput, PilotHerbalClaimLine } from './pilot-herbal-claim-checks.ts'

const AT = { date: '2026-01-15', time: '10:00' }

function line(lineId: string, category: string, overrides: Partial<PilotHerbalClaimLine> = {}): PilotHerbalClaimLine {
  return {
    lineId,
    category,
    feeCode: null,
    name: '',
    hiraApproval: { status: 'APPROVED' },
    herbalDetails: null,
    ...overrides,
  }
}

function input(overrides: Partial<PilotHerbalClaimInput> = {}): PilotHerbalClaimInput {
  return {
    encounterId: 'cur',
    coverage: 'NHIS',
    pilotHerbal: { diseaseCode: '01' },
    serviceAt: AT,
    lines: [],
    diagnoses: [{ code: 'N944', kind: 'PRIMARY' }],
    others: [],
    patientRrn: null,
    doctorRrn: null,
    ...overrides,
  }
}

const codes = (overrides: Partial<PilotHerbalClaimInput>) =>
  pilotHerbalClaimIssues(input(overrides)).map((each) => each.code)

describe('pilotHerbalClaimIssues', () => {
  it('proposes removing the dispensing fee together with the herbal medicine (C0003)', () => {
    const lines = [line('m1', '34001001'), line('m2', '34002001')]
    expect(pilotHerbalClaimIssues(input({ lines }))).toEqual([
      { code: 'C0003', lineIds: ['m1'], fixRemovesLineIds: ['m1', 'm2'] },
    ])
  })

  it('flags every unapproved herbal line (C0005)', () => {
    const lines = [
      line('h1', '35001001', { hiraApproval: { status: 'PENDING' } }),
      line('h2', '35001001', { hiraApproval: null }),
    ]
    expect(pilotHerbalClaimIssues(input({ lines }))).toEqual([{ code: 'C0005', lineIds: ['h1', 'h2'] }])
  })

  it('compares C0004 with every nearby record, not just the latest', () => {
    const deep = line('d1', '35003001', { feeCode: '90401' })
    const other = (encounterId: string, date: string) => ({
      encounterId,
      serviceAt: { date, time: '10:00' },
      lines: [{ category: '35003001', feeCode: '90401' }],
    })
    // 최신 기록은 범위 밖이지만 그 전 기록이 10일 안에 있습니다
    const others = [other('p1', '2026-01-08'), other('p2', '2026-02-20')]
    expect(codes({ lines: [deep], others })).toEqual(['C0004'])
  })

  it('runs only for NHIS or medical aid pilot encounters', () => {
    const lines = [line('a', 'x', { feeCode: '40400' })]
    expect(codes({ lines, coverage: 'MEDICAL_AID' })).toEqual(['C0001'])
    expect(codes({ lines, coverage: 'SELF_PAY' })).toEqual([])
    expect(codes({ lines, pilotHerbal: null })).toEqual([])
  })

  it('keeps other checks when one check has no input (C0002, C0008)', () => {
    const lines = [line('h1', '35001001'), line('a', 'x', { feeCode: '20010' })]
    expect(codes({ lines, diagnoses: [] })).toEqual(['C0001', 'C0008'])
  })

  it('compares dotted diagnosis codes with the undotted prefixes (C0008, C0009)', () => {
    expect(codes({ diagnoses: [{ code: 'N94.4', kind: 'PRIMARY' }] })).toEqual([])
    const sequelae = { pilotHerbal: { diseaseCode: '03' } }
    expect(codes({ ...sequelae, diagnoses: [{ code: 'u23.4', kind: 'SECONDARY' }] })).toEqual([])
    expect(codes({ ...sequelae, diagnoses: [{ code: 'R51', kind: 'SECONDARY' }] })).toEqual(['C0009'])
  })

  it('skips diagnosis checks for diseases missing from the table and ignores empty prefixes', () => {
    const table = new Map([['01', ['']]])
    expect(codes({ pilotHerbal: { diseaseCode: '03' }, diseaseDiagnoses: table, diagnoses: [] })).toEqual([])
    expect(codes({ diseaseDiagnoses: table, diagnoses: [{ code: 'M5110', kind: 'PRIMARY' }] })).toEqual(['C0008'])
  })

  it('treats an unknown checklist status as not submitted (C0006)', () => {
    const details = (checklistSubmitted: boolean | null) => ({ targetDisease: null, checklistSubmitted })
    const lines = [
      line('h1', '35001001', { herbalDetails: details(null) }),
      line('h2', '35001001', { herbalDetails: details(true) }),
      line('h3', '35001001'),
    ]
    expect(pilotHerbalClaimIssues(input({ lines }))).toEqual([{ code: 'C0006', lineIds: ['h1'] }])
  })

  it('points C0011 at the excluded prescriptions', () => {
    const lines = [line('h1', '35001001', { name: '보폐원탕' }), line('h2', '35001001', { name: '반하사심탕' })]
    const issues = pilotHerbalClaimIssues(input({ lines, pilotHerbal: { diseaseCode: '06' }, diagnoses: [] }))
    expect(issues.filter((each) => each.code === 'C0011')).toEqual([{ code: 'C0011', lineIds: ['h1'] }])
  })

  it('flags the doctor treating themself (C0012)', () => {
    const rrn = { front: '800101', back: '1234567' }
    expect(codes({ patientRrn: rrn, doctorRrn: rrn })).toEqual(['C0012'])
    expect(codes({ patientRrn: rrn, doctorRrn: null })).toEqual([])
    // 뒷자리를 모르면 생년월일만 같은 다른 사람일 수 있습니다
    const birthOnly = { front: '800101', back: '' }
    expect(codes({ patientRrn: birthOnly, doctorRrn: birthOnly })).toEqual([])
  })
})
