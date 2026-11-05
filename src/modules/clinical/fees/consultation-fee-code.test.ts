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

describe('isFollowUpVisit', () => {
  const now = { encounterId: 'enc_now', serviceAt: { date: '2026-03-31', time: '10:00' } }

  it('counts a visit exactly N days earlier and not N + 1', () => {
    const at = (date: string) => [{ encounterId: 'enc_1', serviceAt: { date, time: '23:59' } }]
    expect(isFollowUpVisit(now, at('2026-03-01'), 30)).toBe(true)
    expect(isFollowUpVisit(now, at('2026-02-28'), 30)).toBe(false)
  })

  it('ignores the same encounter and later visits', () => {
    const priors = [
      { encounterId: 'enc_now', serviceAt: { date: '2026-03-30', time: '10:00' } },
      { encounterId: 'enc_2', serviceAt: { date: '2026-03-31', time: '10:01' } },
    ]
    expect(isFollowUpVisit(now, priors, 30)).toBe(false)
  })
})

describe('consultationLines', () => {
  it('inserts nothing when automatic judgement is off', () => {
    const off = { ...SETTINGS, initialVisitWindowDays: null }
    expect(consultationLines(input({ settings: off }))).toEqual({ lines: [], warnings: [] })
  })

  it('adds the pattern diagnosis fee after a Saturday pair', () => {
    const result = consultationLines(
      input({
        serviceAt: { date: '2026-03-07', time: '10:00' },
        currentLines: [{ feeCode: '30001', category: '34002001' }],
      }),
    )
    expect(result.lines.map((line) => line.feeCode)).toEqual(['10100', '10100030', '40400'])
  })

  it('drops every consultation line when one Saturday code is missing', () => {
    const master = new Map([...MASTER].filter(([code]) => code !== '10100030'))
    const result = consultationLines(input({ serviceAt: { date: '2026-03-07', time: '10:00' }, feeMaster: master }))
    expect(result).toEqual({ lines: [], warnings: [{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: ['10100030'] }] })
  })
})

describe('pattern diagnosis fee', () => {
  it('keeps the consultation line and warns when 40400 is missing', () => {
    const master = new Map([...MASTER].filter(([code]) => code !== '40400'))
    const result = consultationLines(
      input({ feeMaster: master, currentLines: [{ feeCode: '40011', category: '33001001' }] }),
    )
    expect(result.lines.map((line) => line.feeCode)).toEqual(['10100'])
    expect(result.warnings).toEqual([{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: ['40400'] }])
  })
})

describe('consultationFeeCodes', () => {
  it('ignores a birth date after the service date', () => {
    expect(consultationFeeCodes('10100', input({ birthDate: '2026-03-10' }))).toEqual(['10100'])
  })

  it('treats a newborn as under one', () => {
    const context = input({ birthDate: '2026-02-20' })
    expect(consultationFeeCodes('10100', context)).toEqual(['10100100'])
  })

  it('keeps the proxy digit over a holiday', () => {
    const context = { ...input({ serviceAt: { date: '2026-03-08', time: '10:00' } }), proxyReceipt: true }
    expect(consultationFeeCodes('10200', context)).toEqual(['10200090'])
  })
})
