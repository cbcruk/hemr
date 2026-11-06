import { describe, expect, it } from 'vitest'
import { ageOn, subtractMonths, validateCheckIn } from './check-in-validation.ts'

describe('ageOn', () => {
  it('adds a year on the birthday, not before', () => {
    expect(ageOn('2007-11-02', '2026-11-01')).toBe(18)
    expect(ageOn('2007-11-01', '2026-11-01')).toBe(19)
  })
})

describe('subtractMonths', () => {
  it('keeps the day of month', () => {
    expect(subtractMonths('2026-11-01', 6)).toBe('2026-05-01')
  })

  it('crosses a year boundary', () => {
    expect(subtractMonths('2026-03-15', 6)).toBe('2025-09-15')
  })

  it('clamps to the last day of a shorter month', () => {
    expect(subtractMonths('2026-08-31', 6)).toBe('2026-02-28')
  })
})

describe('validateCheckIn', () => {
  it('collects every blocking error in check order', () => {
    expect(
      validateCheckIn({
        coverage: 'AUTO_INSURANCE',
        date: '2026-11-01',
        autoInsurance: { limit: 100, accumulatedCost: 200, endDate: '2026-10-31' },
        appointmentDate: '2026-10-31',
      }).errors,
    ).toEqual(['AUTO_INSURANCE_LIMIT_EXCEEDED', 'AUTO_INSURANCE_CASE_EXPIRED', 'APPOINTMENT_NOT_TODAY'])
  })

  it('does not check NHIS rules for self-pay visits', () => {
    expect(validateCheckIn({ coverage: 'SELF_PAY', date: '2026-11-01', eligibility: null }).errors).toEqual([])
  })
})

const NHIS = { qualificationCode: '5', selectedInstitutionCodes: [] }
const ADULT = { birthDate: '1990-01-01', firstVisitDate: '2024-01-01', lastIdentityVerifiedOn: '2026-10-01' }

describe('validateCheckIn benefit restriction', () => {
  it.each(['01', '04', '05', '1'])('blocks %s', (code) => {
    const result = validateCheckIn({
      coverage: 'NHIS',
      date: '2026-11-01',
      eligibility: { ...NHIS, benefitRestrictionCode: code },
      patient: ADULT,
    })
    expect(result.errors).toEqual(['NHIS_BENEFIT_RESTRICTED'])
  })

  it.each(['02', '03'])('marks arrears %s without blocking', (code) => {
    const result = validateCheckIn({
      coverage: 'MEDICAL_AID',
      date: '2026-11-01',
      eligibility: { ...NHIS, benefitRestrictionCode: code },
      patient: ADULT,
    })
    expect(result).toMatchObject({ errors: [], benefitRestricted: true })
  })
})

describe('validateCheckIn selected institution', () => {
  const enrollee = {
    coverage: 'MEDICAL_AID' as const,
    date: '2026-11-01',
    eligibility: { qualificationCode: '7', copayCode: 'M001', selectedInstitutionCodes: ['11111111'] },
    clinicInstitutionCode: '12345678',
    patient: ADULT,
  }

  it('blocks an enrollee of another clinic who chose nothing', () => {
    expect(validateCheckIn(enrollee).errors).toEqual(['SELECTED_INSTITUTION_REQUIRED'])
  })

  it('passes with U001 or with B005 and a referring clinic', () => {
    expect(validateCheckIn({ ...enrollee, chosenCopayCode: 'U001' }).errors).toEqual([])
    expect(validateCheckIn({ ...enrollee, chosenCopayCode: 'B005', chosenInstitutionCode: '11111111' }).errors).toEqual(
      [],
    )
  })

  it('keeps blocking B006 with a clinic until the code table is checked', () => {
    expect(validateCheckIn({ ...enrollee, chosenCopayCode: 'B006', chosenInstitutionCode: '11111111' }).errors).toEqual(
      ['SELECTED_INSTITUTION_REQUIRED'],
    )
  })

  it('keeps the clinic when 해당없음 is chosen with one, like the current client', () => {
    const result = validateCheckIn({ ...enrollee, chosenCopayCode: '해당없음', chosenInstitutionCode: '11111111' })
    expect(result.selectedInstitutionCode).toBe('11111111')
  })
})

describe('validateCheckIn identity verification', () => {
  const base = { coverage: 'NHIS' as const, date: '2026-11-01', eligibility: NHIS }

  it('requires verification when the patient is unknown', () => {
    expect(validateCheckIn(base).errors).toEqual(['IDENTITY_VERIFICATION_REQUIRED'])
  })

  it('still honors the NHIS exemption when the patient is unknown', () => {
    expect(validateCheckIn({ ...base, eligibility: { ...NHIS, identityExempt: true } }).errors).toEqual([])
  })

  it('requires verification on a first visit even with a recent check', () => {
    expect(validateCheckIn({ ...base, patient: { ...ADULT, firstVisitDate: null } }).errors).toEqual([
      'IDENTITY_VERIFICATION_REQUIRED',
    ])
  })

  it('exempts a patient the day before their 19th birthday, not on it', () => {
    const patient = { ...ADULT, lastIdentityVerifiedOn: null }
    expect(validateCheckIn({ ...base, patient: { ...patient, birthDate: '2007-11-02' } }).errors).toEqual([])
    expect(validateCheckIn({ ...base, patient: { ...patient, birthDate: '2007-11-01' } }).errors).toEqual([
      'IDENTITY_VERIFICATION_REQUIRED',
    ])
  })

  it('uses the visit history without an age exemption when the birth date is unknown', () => {
    const unknownAge = { ...ADULT, birthDate: null }
    expect(validateCheckIn({ ...base, patient: unknownAge }).errors).toEqual([])
    expect(validateCheckIn({ ...base, patient: { ...unknownAge, lastIdentityVerifiedOn: null } }).errors).toEqual([
      'IDENTITY_VERIFICATION_REQUIRED',
    ])
  })

  it('passes once verified at this check-in', () => {
    expect(validateCheckIn({ ...base, identityVerified: true }).errors).toEqual([])
  })
})

describe('validateCheckIn date format', () => {
  it.each([
    { date: '20261101' },
    { autoInsurance: { limit: null, accumulatedCost: null, endDate: '20261031' } },
    { patient: { ...ADULT, birthDate: '19900101' } },
  ])('throws on a legacy yyyyMMdd date %#', (override) => {
    expect(() => validateCheckIn({ coverage: 'AUTO_INSURANCE', date: '2026-11-01', ...override })).toThrow(RangeError)
  })
})
