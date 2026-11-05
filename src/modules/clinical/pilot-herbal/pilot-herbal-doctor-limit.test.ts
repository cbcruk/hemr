import { describe, expect, it } from 'vitest'
import { judgePilotHerbalDiagnosis } from './pilot-herbal-diagnosis-limit.ts'
import {
  applyPilotHerbalDoctorLimit,
  exceededPilotHerbalDoctorPeriod,
  pilotHerbalDoctorCounts,
  pilotHerbalDoctorUsage,
} from './pilot-herbal-doctor-limit.ts'
import type { PilotHerbalDoctorEncounter } from './pilot-herbal-doctor-limit.ts'
import type { PilotHerbalDiagnosisJudgement } from './pilot-herbal-diagnosis-limit.ts'

const at = (date: string, time = '10:00') => ({ date, time })
const encounter = (
  encounterId: string,
  date: string,
  time = '10:00',
  copayCode: PilotHerbalDoctorEncounter['copayCode'] = 'G',
): PilotHerbalDoctorEncounter => ({ encounterId, serviceAt: at(date, time), copayCode })

describe('pilotHerbalDoctorCounts', () => {
  it('counts the current encounter as the next in line', () => {
    expect(pilotHerbalDoctorCounts({ encounterId: 'cur', serviceAt: at('2026-03-15') }, [])).toEqual({
      day: 1,
      month: 1,
      year: 1,
    })
  })

  it('counts only earlier partial-pay encounters in the same calendar day, month and year', () => {
    const encounters = [
      encounter('a', '2026-03-15', '09:00'),
      encounter('b', '2026-03-15', '11:00'), // 현재 진료보다 뒤라 세지 않습니다
      encounter('c', '2026-03-15', '08:00', 'U'), // 전액부담은 세지 않습니다
      encounter('d', '2026-03-02'),
      encounter('e', '2026-01-20'),
      encounter('f', '2025-12-31'), // 다른 해입니다
      encounter('cur', '2026-03-15'), // 현재 진료 자신은 1로 더합니다
    ]
    expect(pilotHerbalDoctorCounts({ encounterId: 'cur', serviceAt: at('2026-03-15') }, encounters)).toEqual({
      day: 2,
      month: 3,
      year: 4,
    })
  })

  it('skips encounters without a copay code', () => {
    const encounters = [encounter('a', '2026-03-15', '09:00', null)]
    expect(pilotHerbalDoctorCounts({ encounterId: 'cur', serviceAt: at('2026-03-15') }, encounters).day).toBe(1)
  })

  it('makes the 9th partial-pay encounter of the day exceed the limit', () => {
    const encounters = Array.from({ length: 8 }, (_, index) => encounter(`p${index}`, '2026-03-15', `0${index + 1}:00`))
    const counts = pilotHerbalDoctorCounts({ encounterId: 'cur', serviceAt: at('2026-03-15', '12:00') }, encounters)
    expect(counts.day).toBe(9)
    expect(exceededPilotHerbalDoctorPeriod(counts)).toBe('DAY')
    // 미리보기는 쓴 건수에 1을 더해야 서버 판정과 같습니다
    const usage = pilotHerbalDoctorUsage('2026-03-15', encounters)
    expect(usage.day).toBe(8)
    expect(exceededPilotHerbalDoctorPeriod(usage)).toBeNull()
  })

  it('counts the month window across days', () => {
    const encounters = Array.from({ length: 60 }, (_, index) =>
      encounter(`p${index}`, `2026-03-${String((index % 14) + 1).padStart(2, '0')}`),
    )
    const counts = pilotHerbalDoctorCounts({ encounterId: 'cur', serviceAt: at('2026-03-20') }, encounters)
    expect(counts).toEqual({ day: 1, month: 61, year: 61 })
    expect(exceededPilotHerbalDoctorPeriod(counts)).toBe('MONTH')
  })

  it('orders encounters at the same time by encounter id', () => {
    const encounters = [encounter('a', '2026-03-15'), encounter('z', '2026-03-15')]
    expect(pilotHerbalDoctorCounts({ encounterId: 'm', serviceAt: at('2026-03-15') }, encounters).day).toBe(2)
  })
})

describe('applyPilotHerbalDoctorLimit', () => {
  const blocked: PilotHerbalDiagnosisJudgement = {
    copayCode: null,
    fullPayOptional: false,
    warnings: [
      {
        code: 'PILOT_HERBAL_DIAGNOSIS_LIMIT',
        reason: 'OTHER_CLINIC',
        diseaseName: '월경통',
        cumulativeDays: 5,
        lineIds: ['h1'],
        blocksCompletion: true,
      },
    ],
    accepted: false,
  }

  it('forces U and keeps completion as the diagnosis judgement decided', () => {
    const result = applyPilotHerbalDoctorLimit(blocked, ['h1'], { counts: { day: 9, month: 61, year: 601 } })
    expect(result).toEqual({
      copayCode: 'U',
      fullPayOptional: false,
      warnings: [
        ...blocked.warnings,
        {
          code: 'PILOT_HERBAL_DOCTOR_LIMIT',
          period: 'DAY',
          count: 9,
          limit: 8,
          lineIds: ['h1'],
          blocksCompletion: false,
        },
      ],
      accepted: false,
    })
  })

  it('leaves the judgement unchanged within the limit', () => {
    expect(applyPilotHerbalDoctorLimit(blocked, ['h1'], { counts: { day: 8, month: 60, year: 600 } })).toBe(blocked)
  })

  it('forces U alongside the diagnosis warnings and keeps completion allowed', () => {
    const unknown = judgePilotHerbalDiagnosis({ diseaseCode: '01', lineIds: ['h1'], history: null })
    if ('error' in unknown) throw new Error('unexpected error')
    const result = applyPilotHerbalDoctorLimit(unknown, ['h1'], { counts: { day: 1, month: 1, year: 601 } })
    expect(result.copayCode).toBe('U')
    expect(result.accepted).toBe(true)
    expect(result.warnings.map((each) => each.code)).toEqual([
      'PILOT_HERBAL_HISTORY_UNKNOWN',
      'PILOT_HERBAL_DOCTOR_LIMIT',
    ])
    expect(result.warnings[1]).toMatchObject({ period: 'YEAR', count: 601, limit: 600 })
  })

  it('uses injected limits', () => {
    const limits = { day: 1, month: 60, year: 600 }
    const result = applyPilotHerbalDoctorLimit(blocked, ['h1'], { counts: { day: 2, month: 2, year: 2 }, limits })
    expect(result.warnings.at(-1)).toMatchObject({ period: 'DAY', count: 2, limit: 1 })
  })
})
