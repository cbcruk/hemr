import { ageOn } from '../../../shared/time/calendar.ts'
import type {
  CheckInErrorCode,
  CheckInInput,
  CheckInValidation,
  Coverage,
  EligibilityKind,
  IdentityPatient,
} from './check-in-validation.types.ts'

export { ageOn }

/** 접수를 막는 급여제한 코드입니다. 무자격·사망·국외이민은 자격 상실과 같습니다. */
const 접수불가급여제한코드: ReadonlySet<string> = new Set(['01', '04', '05'])
/** 접수는 받되 급여제한 표시를 남기는 체납 코드입니다. */
const 체납급여제한코드: ReadonlySet<string> = new Set(['02', '03'])
/** 선택의료기관 적용자의 본인부담여부입니다. */
const 선택의료기관적용자코드: ReadonlySet<string> = new Set(['M001', 'M002', 'B001', 'B002'])
/** 다른 기관 의뢰를 뜻해 선택의료기관을 함께 적어야 하는 본인부담여부입니다. */
const 의뢰본인부담여부코드: ReadonlySet<string> = new Set(['B005', 'B006', 'B008'])
/** 본인확인이 유효한 기간(개월)입니다. */
const 본인확인유효개월 = 6
/** 이 나이(만 나이)부터 본인확인이 필요합니다. 그 아래는 예외입니다. */
const 본인확인필요나이 = 19

/**
 * 접수 요청을 검증합니다.
 *
 * 현행 클라이언트 접수 패널의 검사를 서버 규칙으로 옮긴 것입니다. 결정과 그 이유는
 * `docs/design/rule-decisions.md`의 check-in-validation에 있습니다. 현행과 달리 보험구분을
 * 몰래 바꾸지 않고, 막을 일이면 오류로 돌려줍니다.
 */
export function validateCheckIn(input: CheckInInput): CheckInValidation {
  assertDates(input)
  const errors: CheckInErrorCode[] = []
  const 공단조회대상 = 공단자격조회대상(input.coverage)
  const 자격종류 = eligibilityKind(input.eligibility?.qualificationCode)
  const 급여제한코드 = 두자리급여제한코드(input.eligibility?.benefitRestrictionCode)

  if (공단조회대상) {
    if (자격종류 === null) errors.push('NHIS_NOT_ELIGIBLE')
    else if (접수불가급여제한코드.has(급여제한코드)) errors.push('NHIS_BENEFIT_RESTRICTED')
    if (선택의료기관누락(input, 자격종류)) errors.push('SELECTED_INSTITUTION_REQUIRED')
    if (identityVerificationBlocks(input, input.patient)) errors.push('IDENTITY_VERIFICATION_REQUIRED')
  }
  if (input.coverage === 'AUTO_INSURANCE' && input.autoInsurance) {
    const { limit, accumulatedCost, endDate } = input.autoInsurance
    if (input.fullSelfPay !== true && limit !== null && limit > 0 && (accumulatedCost ?? 0) > limit) {
      errors.push('AUTO_INSURANCE_LIMIT_EXCEEDED')
    }
    if (endDate && endDate < input.date) errors.push('AUTO_INSURANCE_CASE_EXPIRED')
  }
  if (input.appointmentDate && input.appointmentDate !== input.date) errors.push('APPOINTMENT_NOT_TODAY')

  return {
    errors,
    benefitRestricted: 공단조회대상 && 체납급여제한코드.has(급여제한코드),
    selectedInstitutionCode: 저장할선택의료기관기호(input, 자격종류),
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 날짜 입력이 `YYYY-MM-DD`인지 확인합니다.
 *
 * 날짜를 문자열로 비교하므로, 현행 형식(`yyyyMMdd`)이 변환 없이 들어오면 만료·나이 판정이
 * 조용히 통과합니다. 그런 입력은 호출하는 쪽의 버그라 예외로 알립니다.
 */
function assertDates(input: CheckInInput): void {
  const dates = [
    input.date,
    input.patient?.birthDate,
    input.patient?.firstVisitDate,
    input.patient?.lastIdentityVerifiedOn,
    input.autoInsurance?.endDate,
    input.appointmentDate,
  ]
  for (const date of dates) {
    if (date !== undefined && date !== null && !ISO_DATE.test(date)) {
      throw new RangeError(`Expected a YYYY-MM-DD date, got "${date}"`)
    }
  }
}

/** 급여제한 코드를 두 자리로 맞춥니다. 이관 데이터에 `1`처럼 앞의 0이 빠진 값이 있을 수 있습니다. */
function 두자리급여제한코드(code: string | null | undefined): string {
  const trimmed = (code ?? '').trim()
  return trimmed === '' ? '' : trimmed.padStart(2, '0')
}

/** 공단 자격 조회로 판정하는 보험구분입니다. 현행 화면의 `건보` 탭(건보·의료급여)과 같습니다. */
function 공단자격조회대상(coverage: Coverage): boolean {
  return coverage === 'NHIS' || coverage === 'MEDICAL_AID'
}

/** `자격여부`를 자격 종류로 바꿉니다. 알 수 없는 코드는 `null`입니다. */
export function eligibilityKind(qualificationCode: string | null | undefined): EligibilityKind | null {
  if (qualificationCode === undefined || qualificationCode === null) return null
  if (/^[1-6]$/.test(qualificationCode)) return 'NHIS'
  if (qualificationCode === '7' || qualificationCode === '8') return 'MEDICAL_AID'
  return null
}

/**
 * 선택의료기관을 적어야 하는데 빠졌는지 판정합니다.
 *
 * 의료급여 선택기관 적용자가 우리 기관을 선택기관으로 두지 않았으면 `U001`(전액 본인부담)이나
 * `B005` + 의뢰기관만 받습니다. `B006`/`B008`은 공단 코드표를 확인할 때까지 현행처럼 막습니다
 * (임시 결정). 적용자가 아니어도 의뢰 코드를 골랐으면 기관이 있어야 합니다.
 */
function 선택의료기관누락(input: CheckInInput, 자격종류: EligibilityKind | null): boolean {
  const 고른본인부담여부 = input.chosenCopayCode ?? ''
  const 기관있음 = 기관기호있음(input.chosenInstitutionCode)
  if (의뢰본인부담여부코드.has(고른본인부담여부) && !기관있음) return true

  const 우리기관기호 = input.clinicInstitutionCode ?? ''
  const 다른기관선택적용자 =
    자격종류 === 'MEDICAL_AID' &&
    선택의료기관적용자코드.has((input.eligibility?.copayCode ?? '').trim()) &&
    우리기관기호 !== '' &&
    !(input.eligibility?.selectedInstitutionCodes ?? []).includes(우리기관기호)
  if (!다른기관선택적용자) return false
  return !(고른본인부담여부 === 'U001' || (고른본인부담여부 === 'B005' && 기관있음))
}

function 기관기호있음(code: string | null | undefined): boolean {
  return code !== undefined && code !== null && code !== '' && code !== '없음'
}

/**
 * 저장할 선택의료기관 기호입니다.
 *
 * 의료급여에서 의뢰 코드가 아니면 남은 기관 값을 지웁니다(현행은 `"없음"`을 보냈습니다).
 * 다만 `해당없음`을 고르고 기관을 적었으면 현행처럼 그 기관을 남깁니다.
 */
function 저장할선택의료기관기호(input: CheckInInput, 자격종류: EligibilityKind | null): string | null {
  const 기관기호 = 기관기호있음(input.chosenInstitutionCode) ? input.chosenInstitutionCode! : null
  const 고른본인부담여부 = input.chosenCopayCode ?? ''
  if (자격종류 !== 'MEDICAL_AID') return 기관기호
  return 의뢰본인부담여부코드.has(고른본인부담여부) || 고른본인부담여부 === '해당없음' ? 기관기호 : null
}

/**
 * 본인확인이 필요한데 하지 않아 접수를 막아야 하는지 판정합니다.
 *
 * 환자 정보가 없거나, 첫 내원이거나, 확인한 적이 없거나, 마지막 확인이 6개월보다 오래됐으면
 * 필요합니다. "접수일 − 6개월"과 같은 날 확인했으면 아직 유효합니다. 공단 예외 `Y`, 만 19세 미만,
 * 임산부, 본인부담 100%는 예외입니다. 환자 정보가 없으면 나이·임산부 예외는 판정할 수 없습니다.
 */
export function identityVerificationBlocks(input: CheckInInput, patient: IdentityPatient | undefined): boolean {
  if (input.identityVerified === true) return false
  const 유효시작일 = subtractMonths(input.date, 본인확인유효개월)
  const 확인필요 =
    patient === undefined ||
    !patient.firstVisitDate ||
    !patient.lastIdentityVerifiedOn ||
    patient.lastIdentityVerifiedOn < 유효시작일
  if (!확인필요) return false
  const 예외 =
    input.eligibility?.identityExempt === true ||
    input.fullSelfPay === true ||
    (patient !== undefined &&
      ((patient.birthDate !== null && ageOn(patient.birthDate, input.date) < 본인확인필요나이) ||
        patient.pregnant === true))
  return !예외
}

/** 날짜에서 개월 수를 뺍니다. 그 달에 같은 날이 없으면 말일로 맞춥니다(8월 31일 − 6개월 = 2월 28일). */
export function subtractMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const monthIndex = y * 12 + (m - 1) - months
  const year = Math.floor(monthIndex / 12)
  const month = (monthIndex % 12) + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}
