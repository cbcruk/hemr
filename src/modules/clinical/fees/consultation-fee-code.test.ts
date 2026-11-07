import { describe, expect, it } from 'vitest'
import { consultationFeeCodes, consultationLines, isFollowUpVisit } from './consultation-fee-code.ts'
import type { ConsultationLinesInput, ConsultationSettings } from './consultation-fee-code.ts'

const SETTINGS: ConsultationSettings = {
  ageSurcharge: true,
  nightSurcharge: true,
  excludeSeniorFromNight: false,
  excludeSeniorFromSaturdayHoliday: false,
  daytimeStart: '09:00',
  daytimeEnd: '18:00',
  initialVisitWindowDays: 30,
  addPatternDiagnosisFee: true,
}

const MASTER = new Map([
  ['10100', '초진진찰료'],
  ['10200', '재진진찰료'],
  ['10100030', '초진진찰료-토요'],
  ['40400', '변증기술료'],
])

function input(overrides: Partial<ConsultationLinesInput> = {}): ConsultationLinesInput {
  return {
    encounterId: 'enc_now',
    serviceAt: { date: '2026-03-04', time: '10:00' },
    birthDate: '1990-01-01',
    settings: SETTINGS,
    publicHolidays: new Set(),
    currentLines: [],
    priorEncounters: [],
    feeMaster: MASTER,
    ...overrides,
  }
}

describe('재진 판정 (isFollowUpVisit)', () => {
  const now = { encounterId: 'enc_now', serviceAt: { date: '2026-03-31', time: '10:00' } }

  it('정확히 N일 전 진료는 재진 근거이고 N + 1일 전은 아닙니다', () => {
    const at = (date: string) => [{ encounterId: 'enc_1', serviceAt: { date, time: '23:59' } }]
    expect(isFollowUpVisit(now, at('2026-03-01'), 30)).toBe(true)
    expect(isFollowUpVisit(now, at('2026-02-28'), 30)).toBe(false)
  })

  it('같은 진료와 이후 진료는 세지 않습니다', () => {
    const priors = [
      { encounterId: 'enc_now', serviceAt: { date: '2026-03-30', time: '10:00' } },
      { encounterId: 'enc_2', serviceAt: { date: '2026-03-31', time: '10:01' } },
    ]
    expect(isFollowUpVisit(now, priors, 30)).toBe(false)
  })
})

describe('진찰료 줄 자동 삽입 (consultationLines)', () => {
  it('자동 판정을 끄면 아무 줄도 넣지 않습니다', () => {
    const off = { ...SETTINGS, initialVisitWindowDays: null }
    expect(consultationLines(input({ settings: off }))).toEqual({ lines: [], warnings: [] })
  })

  it('토요 가산 두 줄 뒤에 변증기술료를 더합니다', () => {
    const result = consultationLines(
      input({
        serviceAt: { date: '2026-03-07', time: '10:00' },
        currentLines: [{ feeCode: '30001', category: '34002001' }],
      }),
    )
    expect(result.lines.map((line) => line.feeCode)).toEqual(['10100', '10100030', '40400'])
  })

  it('토요 코드 하나가 마스터에 없으면 진찰료 줄을 모두 빼고 경고합니다', () => {
    const master = new Map([...MASTER].filter(([code]) => code !== '10100030'))
    const result = consultationLines(input({ serviceAt: { date: '2026-03-07', time: '10:00' }, feeMaster: master }))
    expect(result).toEqual({ lines: [], warnings: [{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: ['10100030'] }] })
  })
})

describe('변증기술료', () => {
  it('40400이 마스터에 없으면 진찰료 줄은 넣고 경고합니다', () => {
    const master = new Map([...MASTER].filter(([code]) => code !== '40400'))
    const result = consultationLines(
      input({ feeMaster: master, currentLines: [{ feeCode: '40011', category: '33001001' }] }),
    )
    expect(result.lines.map((line) => line.feeCode)).toEqual(['10100'])
    expect(result.warnings).toEqual([{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: ['40400'] }])
  })
})

describe('진찰료 수가코드 (consultationFeeCodes)', () => {
  it('진료일보다 늦은 생년월일은 나이를 모르는 것으로 봅니다', () => {
    expect(consultationFeeCodes('10100', input({ birthDate: '2026-03-10' }))).toEqual(['10100'])
  })

  it('생후 한 달 안의 영아도 1세 미만 가산을 붙입니다', () => {
    const context = input({ birthDate: '2026-02-20' })
    expect(consultationFeeCodes('10100', context)).toEqual(['10100100'])
  })

  it('공휴일이어도 대리수령 자리가 이깁니다', () => {
    const context = { ...input({ serviceAt: { date: '2026-03-08', time: '10:00' } }), proxyReceipt: true }
    expect(consultationFeeCodes('10200', context)).toEqual(['10200090'])
  })
})
