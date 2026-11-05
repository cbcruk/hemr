import { describe, expect, it } from 'vitest'
import type { ConsultationSettings } from './consultation-fee-code.ts'
import type { FeeMasterRow } from './procedure-fee-modifiers.ts'
import { reconcileTelemedicineLines, telemedicineChangeAllowed } from './telemedicine-fee-lines.ts'
import type { TelemedicineLine, TelemedicineLinesInput } from './telemedicine-fee-lines.ts'

const SETTINGS: ConsultationSettings = {
  ageSurcharge: true,
  nightSurcharge: true,
  excludeSeniorFromNight: false,
  excludeSeniorFromSaturdayHoliday: false,
  daytimeStart: '09:00',
  daytimeEnd: '18:00',
  initialVisitWindowDays: 30,
  addPatternDiagnosisFee: false,
}

const MASTER = new Map<string, FeeMasterRow>([
  ['10100', { name: '초진진찰료', unitPrice: 10000 }],
  ['10100010', { name: '초진진찰료-야간', unitPrice: 12000 }],
  ['91002', { name: '관리료', unitPrice: 3000 }],
])

function line(feeCode: string, lineId: string, overrides: Partial<TelemedicineLine> = {}): TelemedicineLine {
  return {
    lineId,
    feeCode,
    category: '31001001',
    name: feeCode,
    unitPrice: 0,
    amount: 0,
    dailyDose: 1,
    days: 1,
    ...overrides,
  }
}

function input(overrides: Partial<TelemedicineLinesInput>): TelemedicineLinesInput {
  return {
    serviceAt: { date: '2026-03-04', time: '19:00' },
    birthDate: '1990-01-01',
    settings: SETTINGS,
    publicHolidays: new Set(),
    telemedicine: true,
    autoInsuranceSecondVisit: false,
    lines: [],
    feeMaster: MASTER,
    ...overrides,
  }
}

describe('reconcileTelemedicineLines', () => {
  it('keeps one fee line, reusing the first one and its name', () => {
    const result = reconcileTelemedicineLines(
      input({ lines: [line('10100', 'c1'), line('91001', 't1', { name: '내 관리료' }), line('91001', 't2')] }),
    )
    expect(result).toEqual({
      lines: [
        line('10100', 'c1', { name: '초진진찰료', unitPrice: 10000, amount: 10000 }),
        line('91002', 't1', { name: '내 관리료', unitPrice: 3000, amount: 3000 }),
      ],
      warnings: [],
    })
  })

  it('drops the night detail when a night consultation becomes telemedicine', () => {
    const night = line('10100010', 'c1', { lineDetails: [{ kind: 'JS010', content: '202603041900' }] })
    const result = reconcileTelemedicineLines(input({ lines: [night] }))
    // 코드가 바뀐 진찰료는 새 줄이라 ID가 없습니다
    expect('lines' in result && result.lines).toEqual([
      {
        feeCode: '10100',
        category: '31001001',
        name: '초진진찰료',
        unitPrice: 10000,
        amount: 10000,
        dailyDose: 1,
        days: 1,
      },
      { feeCode: '91002', category: '31001001', name: '관리료', unitPrice: 3000, amount: 3000, dailyDose: 1, days: 1 },
    ])
  })

  it('reports every missing code including the fee line', () => {
    const master = new Map([...MASTER].filter(([code]) => code !== '91002'))
    expect(reconcileTelemedicineLines(input({ lines: [line('10100', 'c1')], feeMaster: master }))).toEqual({
      error: 'REFERENCE_DATA_UNAVAILABLE',
      feeCodes: ['91002'],
    })
  })

  it('puts lines in order even when the fee line comes first', () => {
    const result = reconcileTelemedicineLines(
      input({ lines: [line('91002', 't1'), line('40011', 'p1'), line('10100', 'c1')] }),
    )
    expect('lines' in result && result.lines.map((each) => each.lineId)).toEqual(['c1', 'p1', 't1'])
  })

  it('keeps the ID and refreshes only the night detail on a reused face-to-face line', () => {
    const night = line('10100010', 'c1', {
      lineDetails: [
        { kind: 'JX999', content: 'memo' },
        { kind: 'JS010', content: '202603041800' },
      ],
    })
    const result = reconcileTelemedicineLines(input({ telemedicine: false, lines: [line('91002', 't1'), night] }))
    expect(result).toEqual({
      lines: [
        line('10100010', 'c1', {
          name: '초진진찰료-야간',
          unitPrice: 12000,
          amount: 12000,
          lineDetails: [
            { kind: 'JS010', content: '202603041900' },
            { kind: 'JX999', content: 'memo' },
          ],
        }),
      ],
      warnings: [],
    })
  })

  it('warns instead of failing when a face-to-face consultation code is missing', () => {
    const master = new Map([...MASTER].filter(([code]) => code !== '10100010'))
    const lines = [line('10100', 'c1'), line('91002', 't1')]
    expect(reconcileTelemedicineLines(input({ telemedicine: false, lines, feeMaster: master }))).toEqual({
      lines: [line('10100', 'c1')],
      warnings: [{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: ['10100010'] }],
    })
  })

  it('leaves 자보 second visits untouched', () => {
    const lines = [line('10100010', 'c1'), line('91001', 't1')]
    expect(reconcileTelemedicineLines(input({ lines, autoInsuranceSecondVisit: true }))).toEqual({
      lines,
      warnings: [],
    })
  })
})

describe('telemedicineChangeAllowed', () => {
  const eligibility = { coverage: 'AUTO_INSURANCE', herbalPilot: false, homeVisit: false, telemedicine: false } as const

  it('rejects turning it on outside the eligible coverages but always allows turning it off', () => {
    expect(telemedicineChangeAllowed(eligibility, true)).toBe(false)
    expect(telemedicineChangeAllowed({ ...eligibility, telemedicine: true }, false)).toBe(true)
    expect(telemedicineChangeAllowed({ ...eligibility, coverage: 'NHIS' }, true)).toBe(true)
  })
})
