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

describe('추나 자동 제출 판정 (chunaAutoSubmission)', () => {
  it('같은 날 취소되지 않은 제출이 있으면 건너뛰고 취소된 제출만 있으면 제출합니다', () => {
    expect(decision({ sameDaySubmissions: ['FAILED'] })).toEqual({ action: 'SKIP', reason: 'SAME_DAY' })
    expect(decision({ sameDaySubmissions: ['CANCELED'] })).toEqual({ action: 'QUEUE', lineId: 'rx1' })
    expect(decision({ sameDaySubmissions: ['CANCELED', 'REJECTED'] })).toEqual({ action: 'SKIP', reason: 'SAME_DAY' })
    // 다시 완료한 진료의 이전 작업도 같은 날 제출입니다
    expect(decision({ sameDaySubmissions: ['QUEUED'] })).toEqual({ action: 'SKIP', reason: 'SAME_DAY' })
  })

  it('심평원에 추나를 내지 않는 보험구분은 건너뜁니다', () => {
    for (const coverage of ['INDUSTRIAL_ACCIDENT', 'SELF_PAY'] as const) {
      expect(decision({ coverage })).toEqual({ action: 'SKIP', reason: 'COVERAGE_NOT_SUBMITTABLE' })
    }
  })

  it('건보는 한도를 다 쓰면 건너뛰고 자보는 한도를 넘어도 제출합니다', () => {
    expect(decision({ coverage: 'NHIS', hiraUsage: EXHAUSTED })).toEqual({ action: 'SKIP', reason: 'ANNUAL_LIMIT' })
    expect(decision({ coverage: 'AUTO_INSURANCE', hiraUsage: EXHAUSTED })).toEqual({ action: 'QUEUE', lineId: 'rx1' })
  })

  it('사용량 목록이 잘렸으면 한도로 건너뛰지 않습니다', () => {
    expect(decision({ hiraUsage: { ...EXHAUSTED, complete: false } })).toEqual({ action: 'QUEUE', lineId: 'rx1' })
  })

  it('승인되지 않은 첫 추나 줄만 제출합니다', () => {
    const lines = [
      { ...LINE, approved: true },
      { ...LINE, lineId: 'rx2' },
      { ...LINE, lineId: 'rx3' },
    ]
    expect(decision({ lines })).toEqual({ action: 'QUEUE', lineId: 'rx2' })
  })
})

describe('추나 제출 페이로드 (chunaSubmissionPayload)', () => {
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

  it('공상구분코드는 차상위와 희귀난치 지원 기간으로 정합니다', () => {
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

  it('자격여부 8은 의료급여종별 2이고 심평원에 내지 않는 보험구분은 거부합니다', () => {
    const aid = payload({ coverage: 'MEDICAL_AID', ...eligibility({ qualification: '8' }) })
    expect('payload' in aid && [aid.payload.insurerType, aid.payload.medicalAidType]).toEqual(['5', '2'])
    const empty = payload({ coverage: 'MEDICAL_AID', ...eligibility({ qualification: '' }) })
    expect('payload' in empty && empty.payload.insurerType).toBe('5')
    expect(payload({ coverage: 'INDUSTRIAL_ACCIDENT', ...eligibility({ qualification: '4' }) })).toEqual({
      failure: 'COVERAGE_NOT_SUBMITTABLE',
    })
  })
})

describe('기제출 건 결과 (existingSubmissionOutcome)', () => {
  it('기제출 면허번호의 의사가 없으면 시술자 없이 승인 상태로 맞춥니다', () => {
    const doctors = [{ doctorId: 'd1', licenseNumber: null }]
    expect(existingSubmissionOutcome({ diagnosisCodes: 'M5450', licenseNumber: null }, ['M5450'], doctors)).toEqual({
      status: 'APPROVED',
      performer: null,
    })
  })

  it('기제출 조회가 실패하면 제출하지 않고 기제출 건이 없으면 새로 제출합니다', () => {
    expect(precheckOutcome('UNAVAILABLE', ['M5450'], [])).toEqual({ status: 'FAILED', reason: 'PRECHECK_UNAVAILABLE' })
    expect(precheckOutcome(null, ['M5450'], [])).toBeNull()
  })

  it('상병이 비어 있는 기제출 건은 상병 불일치입니다', () => {
    expect(existingSubmissionOutcome({ diagnosisCodes: ' , ', licenseNumber: null }, ['M5450'], [])).toEqual({
      status: 'FAILED',
      reason: 'DIAGNOSIS_MISMATCH',
    })
  })
})

describe('새 제출 결과 (submissionResultOutcome)', () => {
  const performer = { doctorId: 'd1', licenseNumber: 'L-111' }

  it('통신 실패는 심평원이 받았을 수 있어 결과 미상으로 두고 거부는 거부로 남깁니다', () => {
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
