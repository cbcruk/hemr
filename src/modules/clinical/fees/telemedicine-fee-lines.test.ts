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

describe('진찰료·관리료 줄 다시 계산 (reconcileTelemedicineLines)', () => {
  it('관리료 줄은 첫 줄을 다시 쓰고 그 이름을 유지해 한 줄만 둡니다', () => {
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

  it('야간 진찰료가 비대면이 되면 야간 특정내역을 지웁니다', () => {
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

  it('비대면에서 관리료 코드가 마스터에 없으면 REFERENCE_DATA_UNAVAILABLE로 알립니다', () => {
    const master = new Map([...MASTER].filter(([code]) => code !== '91002'))
    expect(reconcileTelemedicineLines(input({ lines: [line('10100', 'c1')], feeMaster: master }))).toEqual({
      error: 'REFERENCE_DATA_UNAVAILABLE',
      feeCodes: ['91002'],
    })
  })

  it('관리료 줄이 앞에 있어도 진찰료, 나머지 처방, 관리료 순으로 둡니다', () => {
    const result = reconcileTelemedicineLines(
      input({ lines: [line('91002', 't1'), line('40011', 'p1'), line('10100', 'c1')] }),
    )
    expect('lines' in result && result.lines.map((each) => each.lineId)).toEqual(['c1', 'p1', 't1'])
  })

  it('대면 진찰료 줄을 다시 쓰면 ID를 유지하고 야간 특정내역만 새로 정합니다', () => {
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

  it('대면 진찰료 코드가 마스터에 없으면 오류 대신 경고하고 진찰료 줄을 그대로 둡니다', () => {
    const master = new Map([...MASTER].filter(([code]) => code !== '10100010'))
    const lines = [line('10100', 'c1'), line('91002', 't1')]
    expect(reconcileTelemedicineLines(input({ telemedicine: false, lines, feeMaster: master }))).toEqual({
      lines: [line('10100', 'c1')],
      warnings: [{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: ['10100010'] }],
    })
  })

  it('자보 1일 2차 진료면 줄을 바꾸지 않습니다', () => {
    const lines = [line('10100010', 'c1'), line('91001', 't1')]
    expect(reconcileTelemedicineLines(input({ lines, autoInsuranceSecondVisit: true }))).toEqual({
      lines,
      warnings: [],
    })
  })
})

describe('비대면 지정 변경 허용 (telemedicineChangeAllowed)', () => {
  const eligibility = { coverage: 'AUTO_INSURANCE', herbalPilot: false, homeVisit: false, telemedicine: false } as const

  it('건보·의료급여가 아니면 켜는 요청을 거부하고 끄는 요청은 늘 허용합니다', () => {
    expect(telemedicineChangeAllowed(eligibility, true)).toBe(false)
    expect(telemedicineChangeAllowed({ ...eligibility, telemedicine: true }, false)).toBe(true)
    expect(telemedicineChangeAllowed({ ...eligibility, coverage: 'NHIS' }, true)).toBe(true)
  })
})
