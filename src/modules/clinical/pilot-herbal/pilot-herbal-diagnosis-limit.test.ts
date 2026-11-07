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

describe('첩약 질환 이력 판정 (judgePilotHerbalDiagnosis)', () => {
  it('등록 여부를 모르는 행이 있어도 타원 이력이면 막고, 모르는 행에만 일수가 있으면 경고만 합니다', () => {
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

  it('참조데이터에 없는 질환도 다른 2개 질환 수에 셉니다', () => {
    const history = [row('02', 'Y', 3), row('99', 'Y', 1)]
    expect(judge('01', history)).toMatchObject({
      warnings: [{ reason: 'TWO_OTHER_DISEASES' }],
      accepted: false,
    })
  })

  it('넘겨받은 참조값의 투약일수 한도에 이르면 전액부담(U)입니다', () => {
    const history = [row('01', 'Y', 15)]
    expect(judge('01', history, 15)).toMatchObject({
      copayCode: 'U',
      accepted: true,
    })
  })
})

describe('질환 이력의 경계 경우', () => {
  it('이력을 받기 전에는 본인부담률 코드를 정하지 않고 경고합니다', () => {
    expect(judge('01', null)).toEqual({
      copayCode: null,
      fullPayOptional: false,
      warnings: [{ code: 'PILOT_HERBAL_HISTORY_UNKNOWN', lineIds: ['h1'], blocksCompletion: false }],
      accepted: true,
    })
  })

  it('다른 2개 질환 이력이 있으면 현행 R0e처럼 공통처방도 막습니다', () => {
    expect(judge('00', [row('02', 'Y', 3), row('04', 'Y', 1)])).toMatchObject({
      copayCode: null,
      warnings: [{ reason: 'TWO_OTHER_DISEASES' }],
      accepted: false,
    })
  })

  it('숫자가 아니거나 음수인 누적 투약일수는 0일로 읽습니다', () => {
    const raw = { diseaseCode: '01', registration: ' y ' }
    expect(pilotHerbalHistoryRow({ ...raw, cumulativeDays: 'abc' })).toEqual(row('01', 'Y', 0))
    expect(pilotHerbalHistoryRow({ ...raw, cumulativeDays: -3 })).toEqual(row('01', 'Y', 0))
    expect(judge('01', [{ ...row('01', 'Y', 0), cumulativeDays: Number.NaN }])).toMatchObject({ copayCode: 'G' })
  })
})

describe('질환 이력 위반 문구 (pilotHerbalDiagnosisMessage)', () => {
  const issue = (diseaseName: string): PilotHerbalDiagnosisLimit => ({
    code: 'PILOT_HERBAL_DIAGNOSIS_LIMIT',
    reason: 'OTHER_CLINIC',
    diseaseName,
    cumulativeDays: 3,
    lineIds: [],
    blocksCompletion: true,
  })

  it('받침이 없거나 ㄹ 받침이면 로, 그 밖의 받침이면 으로를 붙입니다', () => {
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
