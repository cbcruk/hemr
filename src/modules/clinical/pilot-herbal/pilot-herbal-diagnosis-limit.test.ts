import { describe, expect, it } from 'vitest'
import {
  hiraRegistration,
  judgePilotHerbalDiagnosis,
  pilotHerbalDiagnosisMessage,
  pilotHerbalHistoryRow,
} from './pilot-herbal-diagnosis-limit.ts'
import type { PilotHerbalDiagnosisLimit, PilotHerbalHistoryRow } from './pilot-herbal-diagnosis-limit.ts'

function row(diseaseCode: string, flag: string, cumulativeDays: number): PilotHerbalHistoryRow {
  return { diseaseCode, registration: hiraRegistration(flag), cumulativeDays }
}

function judge(diseaseCode: string, history: PilotHerbalHistoryRow[] | null, dayLimit?: number) {
  const limit = dayLimit === undefined ? {} : { dayLimit }
  return judgePilotHerbalDiagnosis({ diseaseCode, lineIds: ['h1'], history, ...limit })
}

describe('judgePilotHerbalDiagnosis', () => {
  it('blocks on another clinic even when unknown rows exist, and warns when only unknown rows have days', () => {
    const mixed = judge('01', [row('01', 'N', 3), row('01', '', 30)])
    expect(mixed).toMatchObject({ copayCode: null, accepted: false })
    const unknown = judge('01', [row('01', 'N', 0), row('01', '', 30)])
    expect(unknown).toEqual({
      copayCode: null,
      fullPayOptional: false,
      warnings: [{ code: 'PILOT_HERBAL_HISTORY_UNVERIFIED', lineIds: ['h1'], blocksCompletion: false }],
      accepted: true,
    })
  })

  it('counts a disease missing from the reference toward the two-disease limit', () => {
    const history = [row('02', 'Y', 3), row('99', 'Y', 1)]
    expect(judge('01', history)).toMatchObject({
      warnings: [{ reason: 'TWO_OTHER_DISEASES' }],
      accepted: false,
    })
  })

  it('reads the day limit from the reference value', () => {
    const history = [row('01', 'Y', 15)]
    expect(judge('01', history, 15)).toMatchObject({
      copayCode: 'U',
      accepted: true,
    })
  })
})

describe('history edge cases', () => {
  it('does not set a copay code before the history arrives', () => {
    expect(judge('01', null)).toEqual({
      copayCode: null,
      fullPayOptional: false,
      warnings: [{ code: 'PILOT_HERBAL_HISTORY_UNKNOWN', lineIds: ['h1'], blocksCompletion: false }],
      accepted: true,
    })
  })

  it('blocks the common prescription too when two other diseases exist, as R0e does', () => {
    expect(judge('00', [row('02', 'Y', 3), row('04', 'Y', 1)])).toMatchObject({
      copayCode: null,
      warnings: [{ reason: 'TWO_OTHER_DISEASES' }],
      accepted: false,
    })
  })

  it('reads non-numeric and negative days as zero', () => {
    const raw = { diseaseCode: '01', registration: ' y ' }
    expect(pilotHerbalHistoryRow({ ...raw, cumulativeDays: 'abc' })).toEqual(row('01', 'Y', 0))
    expect(pilotHerbalHistoryRow({ ...raw, cumulativeDays: -3 })).toEqual(row('01', 'Y', 0))
    expect(judge('01', [{ ...row('01', 'Y', 0), cumulativeDays: Number.NaN }])).toMatchObject({ copayCode: 'G' })
  })
})

describe('pilotHerbalDiagnosisMessage', () => {
  const issue = (diseaseName: string): PilotHerbalDiagnosisLimit => ({
    code: 'PILOT_HERBAL_DIAGNOSIS_LIMIT',
    reason: 'OTHER_CLINIC',
    diseaseName,
    cumulativeDays: 3,
    lineIds: [],
    blocksCompletion: true,
  })

  it('picks 로 after no final consonant or ㄹ and 으로 otherwise', () => {
    expect(pilotHerbalDiagnosisMessage(issue('안면신경마비'))).toBe('환자가 타원에서 안면신경마비로 처방받았습니다.')
    expect(pilotHerbalDiagnosisMessage(issue('기능성소화불량'))).toBe(
      '환자가 타원에서 기능성소화불량으로 처방받았습니다.',
    )
    expect(pilotHerbalDiagnosisMessage(issue('뇌혈관질환후유증'))).toBe(
      '환자가 타원에서 뇌혈관질환후유증으로 처방받았습니다.',
    )
    expect(pilotHerbalDiagnosisMessage(issue('발'))).toBe('환자가 타원에서 발로 처방받았습니다.')
    expect(pilotHerbalDiagnosisMessage(issue(''))).toBe('환자가 타원에서 로 처방받았습니다.')
  })
})
