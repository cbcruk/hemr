import { describe, expect, it } from 'vitest'
import {
  chunaAutoSubmission,
  chunaSubmissionPayload,
  existingSubmissionOutcome,
  precheckOutcome,
  submissionResultOutcome,
} from './chuna-auto-submission.ts'
import type { ChunaAutoSubmissionInput, ChunaPayloadInput } from './chuna-auto-submission.ts'

const AT = { date: '2026-11-01', time: '09:30' }
const LINE = { lineId: 'rx1', feeCode: '40710', category: '33001005', approved: false, performerId: 'd1' }
const EXHAUSTED = { rows: [], cumulativeCount: 20, complete: true }

function decision(overrides: Partial<ChunaAutoSubmissionInput> = {}) {
  return chunaAutoSubmission({
    coverage: 'NHIS',
    serviceAt: AT,
    autoSubmit: true,
    lines: [LINE],
    hiraUsage: null,
    sameDaySubmissions: [],
    ...overrides,
  })
}

function payload(overrides: Partial<ChunaPayloadInput> = {}) {
  return chunaSubmissionPayload({
    clinicCode: '12345678',
    coverage: 'NHIS',
    serviceAt: AT,
    patient: { name: '홍길동', rrnFront: '900101', rrnBack: '1234567' },
    diagnosisCodes: ['M5450'],
    line: LINE,
    defaultPerformerId: null,
    doctors: [{ doctorId: 'd1', licenseNumber: 'L-111' }],
    eligibility: { qualification: '4', disabled: false, nearPoverty: null, rareDiseaseSupportTarget: null },
    accidentNumber: null,
    rareDiseaseSupport: false,
    ...overrides,
  })
}

describe('chunaAutoSubmission', () => {
  it('skips while a same-day submission is active but not when it was canceled', () => {
    expect(decision({ sameDaySubmissions: ['FAILED'] })).toEqual({ action: 'SKIP', reason: 'SAME_DAY' })
    expect(decision({ sameDaySubmissions: ['CANCELED'] })).toEqual({ action: 'QUEUE', lineId: 'rx1' })
    expect(decision({ sameDaySubmissions: ['CANCELED', 'REJECTED'] })).toEqual({ action: 'SKIP', reason: 'SAME_DAY' })
    // 다시 완료한 진료의 이전 작업도 같은 날 제출입니다
    expect(decision({ sameDaySubmissions: ['QUEUED'] })).toEqual({ action: 'SKIP', reason: 'SAME_DAY' })
  })

  it('skips coverages HIRA does not take chuna for', () => {
    for (const coverage of ['INDUSTRIAL_ACCIDENT', 'SELF_PAY'] as const) {
      expect(decision({ coverage })).toEqual({ action: 'SKIP', reason: 'COVERAGE_NOT_SUBMITTABLE' })
    }
  })

  it('keeps submitting 자보 past the limit', () => {
    expect(decision({ coverage: 'NHIS', hiraUsage: EXHAUSTED })).toEqual({ action: 'SKIP', reason: 'ANNUAL_LIMIT' })
    expect(decision({ coverage: 'AUTO_INSURANCE', hiraUsage: EXHAUSTED })).toEqual({ action: 'QUEUE', lineId: 'rx1' })
  })

  it('does not skip on the limit when the usage list was truncated', () => {
    expect(decision({ hiraUsage: { ...EXHAUSTED, complete: false } })).toEqual({ action: 'QUEUE', lineId: 'rx1' })
  })

  it('submits the first unapproved chuna line only', () => {
    const lines = [
      { ...LINE, approved: true },
      { ...LINE, lineId: 'rx2' },
      { ...LINE, lineId: 'rx3' },
    ]
    expect(decision({ lines })).toEqual({ action: 'QUEUE', lineId: 'rx2' })
  })
})

describe('chunaSubmissionPayload', () => {
  const eligibility = (overrides: object) => ({
    eligibility: {
      qualification: '4',
      disabled: false,
      nearPoverty: null,
      rareDiseaseSupportTarget: null,
      ...overrides,
    },
  })
  const category = (result: ReturnType<typeof payload>) => ('payload' in result ? result.payload.benefitCategory : null)

  it('derives the benefit category from near-poverty and rare-disease support periods', () => {
    expect(category(payload(eligibility({ nearPoverty: 'E00120260101        1', disabled: true })))).toBe('F')
    expect(category(payload(eligibility({ nearPoverty: 'E00120260101        1' })))).toBe('E')
    expect(category(payload(eligibility({ nearPoverty: 'E0012026010120260131 1' })))).toBe('0')
    const rare = { rareDiseaseSupportTarget: 'H00120260101        ' }
    expect(category(payload(eligibility(rare)))).toBe('0')
    expect(category(payload({ ...eligibility(rare), rareDiseaseSupport: true }))).toBe('H')
    // 차상위가 끝났으면 희귀난치 지원으로 내려갑니다
    const expired = { nearPoverty: 'C0002025010120251231 1', ...rare }
    expect(category(payload({ ...eligibility(expired), rareDiseaseSupport: true }))).toBe('H')
  })

  it('maps qualification 8 to medical aid type 2 and rejects coverages HIRA does not take', () => {
    const aid = payload({ coverage: 'MEDICAL_AID', ...eligibility({ qualification: '8' }) })
    expect('payload' in aid && [aid.payload.insurerType, aid.payload.medicalAidType]).toEqual(['5', '2'])
    const empty = payload({ coverage: 'MEDICAL_AID', ...eligibility({ qualification: '' }) })
    expect('payload' in empty && empty.payload.insurerType).toBe('5')
    expect(payload({ coverage: 'INDUSTRIAL_ACCIDENT', ...eligibility({ qualification: '4' }) })).toEqual({
      failure: 'COVERAGE_NOT_SUBMITTABLE',
    })
  })
})

describe('existingSubmissionOutcome', () => {
  it('syncs without a performer when no doctor has the submitted license', () => {
    const doctors = [{ doctorId: 'd1', licenseNumber: null }]
    expect(existingSubmissionOutcome({ diagnosisCodes: 'M5450', licenseNumber: null }, ['M5450'], doctors)).toEqual({
      status: 'APPROVED',
      performer: null,
    })
  })

  it('does not submit when the pre-check lookup failed', () => {
    expect(precheckOutcome('UNAVAILABLE', ['M5450'], [])).toEqual({ status: 'FAILED', reason: 'PRECHECK_UNAVAILABLE' })
    expect(precheckOutcome(null, ['M5450'], [])).toBeNull()
  })

  it('treats an existing submission without diagnoses as a mismatch', () => {
    expect(existingSubmissionOutcome({ diagnosisCodes: ' , ', licenseNumber: null }, ['M5450'], [])).toEqual({
      status: 'FAILED',
      reason: 'DIAGNOSIS_MISMATCH',
    })
  })
})

describe('submissionResultOutcome', () => {
  const performer = { doctorId: 'd1', licenseNumber: 'L-111' }

  it('keeps a transport failure unknown because HIRA may have received it', () => {
    expect(submissionResultOutcome({ ok: false, kind: 'TRANSPORT', reason: 'timeout' }, performer)).toEqual({
      status: 'OUTCOME_UNKNOWN',
      reason: 'timeout',
    })
    expect(submissionResultOutcome({ ok: false, kind: 'REJECTED', reason: 'E01' }, performer)).toEqual({
      status: 'REJECTED',
      reason: 'E01',
    })
  })
})
