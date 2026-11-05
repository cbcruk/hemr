import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { eligibilityKind, validateCheckIn } from './check-in-validation.ts'
import type { CheckInErrorCode, CheckInInput, Coverage } from './check-in-validation.types.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/check-in-validation.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 입력(한글 키, `yyyyMMdd`)을 `CheckInInput`으로 바꾸고, 결정
 * (`docs/design/rule-decisions.md`의 check-in-validation)에 따른 기대값으로 검사합니다.
 * 현행과 기대값이 다른 케이스는 `changed`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/check-in-validation.json'), 'utf8'),
) as { cases: FixtureCase[] }

const TODAY = '2026-11-01'
const COVERAGE: Record<string, Coverage> = {
  건보: 'NHIS',
  일반: 'SELF_PAY',
  자보: 'AUTO_INSURANCE',
  급여: 'MEDICAL_AID',
}

function isoDate(yyyymmdd: string | null | undefined): string | null {
  if (!yyyymmdd) return null
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

/** 한도는 정수 필드라 빈 값·숫자가 아닌 값은 이관할 때 `null`(한도 없음)이 됩니다 (결정 5). */
function limitOf(value: string): number | null {
  const limit = Number(value)
  return value.trim() === '' || !Number.isFinite(limit) ? null : limit
}

function errorsOf(input: CheckInInput): CheckInErrorCode[] {
  return validateCheckIn(input).errors
}

function cases(check: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['check'] === check && !(testCase.name in NOT_PORTED))
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'validate: 산정특례 visit without selection':
    '접수에서 막지 않고 special-case-code-match 규칙이 진료 완료 때 막습니다(rule-decisions.md의 check-in-validation 구현 메모)',
  'validate: 본인확인 required but unchecked': 'selfVerification 케이스들이 같은 규칙을 검사합니다',
  'selected inst: blocked dialog text': '화면 문구입니다',
  'auto limit exceeded: dialog confirm aborts check-in': '화면 흐름입니다. 서버는 항상 422로 막습니다(결정 6)',
  'insurance change blocked when an approved prescription exists': '보험구분 변경(:change-coverage)이 아직 없습니다',
  'appointment today, 내원 -> check-in hidden': '예약 상태별 버튼 표시는 화면 규칙입니다',
  'appointment today, no 접수생성 permission': '권한 모델이 아직 없습니다',
}

describe('check-in-validation fixture', () => {
  describe('benefit restriction (결정 1·2: 01·04·05는 막고 02·03은 표시만, 보험구분은 바꾸지 않음)', () => {
    const blocked = new Set(['01', '04', '05'])
    const arrears = new Set(['02', '03'])
    it.each(cases('benefitRestrictionSwitch').map((c) => [c.name, c] as const))('%s', (_, { input }) => {
      const coverage = COVERAGE[input['selectedInsuranceType']]!
      const code = input['급여제한여부'] ?? null
      const result = validateCheckIn({
        coverage,
        date: TODAY,
        eligibility: { qualificationCode: '5', benefitRestrictionCode: code, selectedInstitutionCodes: [] },
      })
      const national = coverage === 'NHIS'

      expect(result.errors.includes('NHIS_BENEFIT_RESTRICTED')).toBe(national && blocked.has(code))
      expect(result.benefitRestricted).toBe(national && arrears.has(code))
    })
  })

  describe('eligibility kind (자격여부)', () => {
    const KIND = { 건보: 'NHIS', 급여: 'MEDICAL_AID' } as const
    it.each(cases('x0e').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      expect(eligibilityKind(input['자격여부'])).toBe(expected === null ? null : KIND[expected as keyof typeof KIND])
    })
  })

  describe('NHIS eligibility', () => {
    it.each(cases('validateInsuranceType').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const eligibility =
        input['조회결과있음'] === false
          ? null
          : { qualificationCode: input['자격여부'] as string, selectedInstitutionCodes: [] }
      const errors = errorsOf({ coverage: COVERAGE[input['selectedInsuranceType']]!, date: TODAY, eligibility })

      expect(errors.includes('NHIS_NOT_ELIGIBLE')).toBe(expected.ok === false)
    })
  })

  describe('selected institution gate (결정 3, 결정 4는 현행 유지)', () => {
    it.each(cases('selectedInstitutionGate').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const errors = errorsOf({
        coverage: COVERAGE[input['selectedInsuranceType']]!,
        date: TODAY,
        eligibility: {
          qualificationCode: input['자격여부'],
          copayCode: input['본인부담여부'],
          selectedInstitutionCodes: input['선택기관기호목록'],
        },
        clinicInstitutionCode: input['요양기관기호'],
        chosenCopayCode: input['선택된본인부담여부'],
        chosenInstitutionCode: input['선택된기관기호'],
      })

      expect(errors.includes('SELECTED_INSTITUTION_REQUIRED')).toBe(expected.blockedByDialog)
    })
  })

  describe('referral copay codes need an institution (AD)', () => {
    it.each(cases('AD').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const errors = errorsOf({
        coverage: 'NHIS',
        date: TODAY,
        eligibility: { qualificationCode: '5', selectedInstitutionCodes: [] },
        chosenCopayCode: input['선택된본인부담여부'],
        chosenInstitutionCode: input['선택된기관기호'],
      })

      expect(errors.includes('SELECTED_INSTITUTION_REQUIRED')).toBe(expected !== null)
    })
  })

  describe('stored institution (ED: 현행 "없음" 대신 null)', () => {
    it.each(cases('ED').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const coverage = COVERAGE[input['보험구분']]!
      const result = validateCheckIn({
        coverage,
        date: TODAY,
        eligibility: { qualificationCode: coverage === 'MEDICAL_AID' ? '7' : '5', selectedInstitutionCodes: [] },
        chosenCopayCode: input['선택된본인부담여부'],
        chosenInstitutionCode: input['선택된기관']['선택된기관기호'],
      })
      const sent = expected['선택된기관기호'] as string

      expect(result.selectedInstitutionCode).toBe(sent === '없음' || sent === '' ? null : sent)
    })
  })

  describe('auto insurance limit (결정 5: 초과일 때만, 같으면 통과)', () => {
    it.each(cases('autoInsuranceLimitExceeded').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const errors = errorsOf({
        coverage: COVERAGE[input['selectedInsuranceType']]!,
        date: TODAY,
        fullSelfPay: input['자보100체크'],
        eligibility: { qualificationCode: '5', selectedInstitutionCodes: [] },
        autoInsurance: { limit: limitOf(input['보증한도금액']), accumulatedCost: input['진료비총액'] },
      })

      expect(errors.includes('AUTO_INSURANCE_LIMIT_EXCEEDED')).toBe(expected)
    })
  })

  describe('auto insurance expiry (결정 7: 종료일 당일까지 유효, 현행 미리 채우기 경계와 같음)', () => {
    it.each(cases('prefillPreviousAutoInsurance').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const errors = errorsOf({
        coverage: 'AUTO_INSURANCE',
        date: isoDate(input['today'])!,
        autoInsurance: { limit: null, accumulatedCost: null, endDate: isoDate(input['보증종료일자']) },
      })

      expect(errors.includes('AUTO_INSURANCE_CASE_EXPIRED')).toBe(!expected)
    })
  })

  describe('identity verification (결정 9)', () => {
    it.each(cases('selfVerification').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const date = isoDate(input['today'])!
      const patient = input['환자정보']
      // 현행 하네스는 만 나이를 입력으로 받았습니다. 서버는 생년월일로 계산하므로, 올해 생일이 지난 생년월일을 씁니다.
      const birthDate = `${Number(date.slice(0, 4)) - input['만나이']}-01-01`
      const errors = errorsOf({
        coverage: 'NHIS',
        date,
        fullSelfPay: input['건보100체크'] === true,
        eligibility: {
          qualificationCode: '5',
          selectedInstitutionCodes: [],
          identityExempt: input['건보자격조회결과']?.['본인확인예외여부'] === 'Y',
        },
        patient: {
          birthDate,
          firstVisitDate: isoDate(patient['최초내원일']),
          lastIdentityVerifiedOn: isoDate(patient['본인확인일자']),
          pregnant: patient['임산부여부'] === true,
        },
        identityVerified: input['본인확인체크'],
      })

      expect(errors.includes('IDENTITY_VERIFICATION_REQUIRED')).toBe(expected.blocks)
    })
  })

  describe('appointment date (결정 8: 버튼이 아니라 서버가 막음)', () => {
    it.each(cases('appointmentCheckInButton').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const errors = errorsOf({
        coverage: 'SELF_PAY',
        date: isoDate(input['today'])!,
        appointmentDate: isoDate(input['예약일자']),
      })

      expect(errors.includes('APPOINTMENT_NOT_TODAY')).toBe(!expected.checkInEnabled)
    })
  })

  it('accounts for every case that is not ported', () => {
    const checks = new Set([
      'benefitRestrictionSwitch',
      'x0e',
      'validateInsuranceType',
      'selectedInstitutionGate',
      'AD',
      'ED',
      'autoInsuranceLimitExceeded',
      'prefillPreviousAutoInsurance',
      'selfVerification',
      'appointmentCheckInButton',
    ])
    const rest = fixture.cases
      .filter((testCase) => !checks.has(testCase.input['check']) || testCase.name in NOT_PORTED)
      .map((testCase) => testCase.name)

    expect(rest.sort()).toEqual(Object.keys(NOT_PORTED).sort())
  })
})
