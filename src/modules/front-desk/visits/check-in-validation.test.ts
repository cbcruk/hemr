import { describe, expect, it } from 'vitest'
import { ageOn, subtractMonths, validateCheckIn } from './check-in-validation.ts'

describe('만 나이 (ageOn)', () => {
  it('생일 당일부터 한 살 많고 그 전날은 그대로입니다', () => {
    expect(ageOn('2007-11-02', '2026-11-01')).toBe(18)
    expect(ageOn('2007-11-01', '2026-11-01')).toBe(19)
  })
})

describe('개월 빼기 (subtractMonths)', () => {
  it('같은 날짜를 유지합니다', () => {
    expect(subtractMonths('2026-11-01', 6)).toBe('2026-05-01')
  })

  it('해를 넘어갑니다', () => {
    expect(subtractMonths('2026-03-15', 6)).toBe('2025-09-15')
  })

  it('그 달에 같은 날이 없으면 말일로 맞춥니다', () => {
    expect(subtractMonths('2026-08-31', 6)).toBe('2026-02-28')
  })
})

describe('접수 검증 (validateCheckIn)', () => {
  it('막는 오류를 검사 순서대로 모두 모읍니다', () => {
    expect(
      validateCheckIn({
        coverage: 'AUTO_INSURANCE',
        date: '2026-11-01',
        autoInsurance: { limit: 100, accumulatedCost: 200, endDate: '2026-10-31' },
        appointmentDate: '2026-10-31',
      }).errors,
    ).toEqual(['AUTO_INSURANCE_LIMIT_EXCEEDED', 'AUTO_INSURANCE_CASE_EXPIRED', 'APPOINTMENT_NOT_TODAY'])
  })

  it('일반 내원은 공단 자격 규칙을 보지 않습니다', () => {
    expect(validateCheckIn({ coverage: 'SELF_PAY', date: '2026-11-01', eligibility: null }).errors).toEqual([])
  })
})

const NHIS = { qualificationCode: '5', selectedInstitutionCodes: [] }
const ADULT = { birthDate: '1990-01-01', firstVisitDate: '2024-01-01', lastIdentityVerifiedOn: '2026-10-01' }

describe('접수 검증: 급여제한', () => {
  it.each(['01', '04', '05', '1'])('급여제한 %s는 접수를 막습니다(앞 0이 빠진 값 포함)', (code) => {
    const result = validateCheckIn({
      coverage: 'NHIS',
      date: '2026-11-01',
      eligibility: { ...NHIS, benefitRestrictionCode: code },
      patient: ADULT,
    })
    expect(result.errors).toEqual(['NHIS_BENEFIT_RESTRICTED'])
  })

  it.each(['02', '03'])('체납 %s는 막지 않고 급여제한으로 표시합니다', (code) => {
    const result = validateCheckIn({
      coverage: 'MEDICAL_AID',
      date: '2026-11-01',
      eligibility: { ...NHIS, benefitRestrictionCode: code },
      patient: ADULT,
    })
    expect(result).toMatchObject({ errors: [], benefitRestricted: true })
  })
})

describe('접수 검증: 선택의료기관', () => {
  const enrollee = {
    coverage: 'MEDICAL_AID' as const,
    date: '2026-11-01',
    eligibility: { qualificationCode: '7', copayCode: 'M001', selectedInstitutionCodes: ['11111111'] },
    clinicInstitutionCode: '12345678',
    patient: ADULT,
  }

  it('다른 기관의 선택의료기관 적용자가 아무것도 고르지 않으면 막습니다', () => {
    expect(validateCheckIn(enrollee).errors).toEqual(['SELECTED_INSTITUTION_REQUIRED'])
  })

  it('U001이나 B005와 의뢰기관이면 통과합니다', () => {
    expect(validateCheckIn({ ...enrollee, chosenCopayCode: 'U001' }).errors).toEqual([])
    expect(validateCheckIn({ ...enrollee, chosenCopayCode: 'B005', chosenInstitutionCode: '11111111' }).errors).toEqual(
      [],
    )
  })

  it('공단 코드표를 확인할 때까지 B006은 기관이 있어도 막습니다', () => {
    expect(validateCheckIn({ ...enrollee, chosenCopayCode: 'B006', chosenInstitutionCode: '11111111' }).errors).toEqual(
      ['SELECTED_INSTITUTION_REQUIRED'],
    )
  })

  it('해당없음을 고르고 기관을 적으면 현행처럼 기관을 남깁니다', () => {
    const result = validateCheckIn({ ...enrollee, chosenCopayCode: '해당없음', chosenInstitutionCode: '11111111' })
    expect(result.selectedInstitutionCode).toBe('11111111')
  })
})

describe('접수 검증: 본인확인', () => {
  const base = { coverage: 'NHIS' as const, date: '2026-11-01', eligibility: NHIS }

  it('환자 정보가 없으면 본인확인이 필요합니다', () => {
    expect(validateCheckIn(base).errors).toEqual(['IDENTITY_VERIFICATION_REQUIRED'])
  })

  it('환자 정보가 없어도 공단 예외는 따릅니다', () => {
    expect(validateCheckIn({ ...base, eligibility: { ...NHIS, identityExempt: true } }).errors).toEqual([])
  })

  it('첫 내원은 최근에 확인했어도 본인확인이 필요합니다', () => {
    expect(validateCheckIn({ ...base, patient: { ...ADULT, firstVisitDate: null } }).errors).toEqual([
      'IDENTITY_VERIFICATION_REQUIRED',
    ])
  })

  it('만 19세 생일 전날까지 예외이고 생일 당일부터는 아닙니다', () => {
    const patient = { ...ADULT, lastIdentityVerifiedOn: null }
    expect(validateCheckIn({ ...base, patient: { ...patient, birthDate: '2007-11-02' } }).errors).toEqual([])
    expect(validateCheckIn({ ...base, patient: { ...patient, birthDate: '2007-11-01' } }).errors).toEqual([
      'IDENTITY_VERIFICATION_REQUIRED',
    ])
  })

  it('생년월일을 모르면 나이 예외 없이 내원 이력으로 판정합니다', () => {
    const unknownAge = { ...ADULT, birthDate: null }
    expect(validateCheckIn({ ...base, patient: unknownAge }).errors).toEqual([])
    expect(validateCheckIn({ ...base, patient: { ...unknownAge, lastIdentityVerifiedOn: null } }).errors).toEqual([
      'IDENTITY_VERIFICATION_REQUIRED',
    ])
  })

  it('이번 접수에서 확인했으면 통과합니다', () => {
    expect(validateCheckIn({ ...base, identityVerified: true }).errors).toEqual([])
  })
})

describe('접수 검증: 날짜 형식', () => {
  it.each([
    { date: '20261101' },
    { autoInsurance: { limit: null, accumulatedCost: null, endDate: '20261031' } },
    { patient: { ...ADULT, birthDate: '19900101' } },
  ])('현행 yyyyMMdd 날짜는 예외를 던집니다 %#', (override) => {
    expect(() => validateCheckIn({ coverage: 'AUTO_INSURANCE', date: '2026-11-01', ...override })).toThrow(RangeError)
  })
})
