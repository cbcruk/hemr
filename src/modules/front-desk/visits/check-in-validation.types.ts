import type { Coverage } from '../../../shared/coverage.ts'

export type { Coverage }

/** 건보 자격 조회의 `자격여부`가 뜻하는 자격 종류입니다. `1`–`6`은 건보, `7`·`8`은 의료급여입니다. */
export type EligibilityKind = 'NHIS' | 'MEDICAL_AID'

/** 건보 자격 조회(공단) 결과 중 접수 검증에 쓰는 값입니다. 코드는 공단이 정한 값 그대로입니다. */
export interface NhisEligibility {
  /** `자격여부`. */
  qualificationCode: string
  /** `급여제한여부`. `01` 무자격, `02` 체납 6회 이상, `03` 외국인·재외국민 체납, `04` 사망, `05` 국외이민. */
  benefitRestrictionCode?: string | null
  /** `본인부담여부`. `M001`/`M002`/`B001`/`B002`는 선택의료기관 적용자입니다. */
  copayCode?: string | null
  /** 선택기관기호 1–4. */
  selectedInstitutionCodes: ReadonlyArray<string>
  /** `본인확인예외여부`가 `Y`인지. */
  identityExempt?: boolean
}

/** 본인확인 판정에 쓰는 환자 정보입니다. */
export interface IdentityPatient {
  /** 생년월일 `YYYY-MM-DD`. 만 나이를 서버가 계산합니다. 모르면 `null`이고, 나이 예외를 판정하지 않습니다. */
  birthDate: string | null
  /** 최초 내원일. 없으면 첫 내원입니다. */
  firstVisitDate?: string | null
  /** 마지막 본인확인일. */
  lastIdentityVerifiedOn?: string | null
  pregnant?: boolean
}

/** 자보 지급보증 정보입니다. */
export interface AutoInsuranceGuarantee {
  /** 보증 한도(원). `null`이나 0이면 한도가 없습니다. */
  limit: number | null
  /** 이 사고로 지금까지 쌓인 진료비(원). */
  accumulatedCost: number | null
  /** 보증 종료일 `YYYY-MM-DD`. 그날까지 유효합니다. */
  endDate?: string | null
}

/** 접수 요청 하나를 검증하는 데 필요한 값입니다. */
export interface CheckInInput {
  coverage: Coverage
  /** 접수일 `YYYY-MM-DD` (병원 시간대). */
  date: string
  /** 본인부담 100%(`benefitFlags.fullSelfPay`). 건보 본인확인 예외이자 자보 한도 검사 생략 조건입니다. */
  fullSelfPay?: boolean
  eligibility?: NhisEligibility | null
  /** 우리 기관의 요양기관기호. */
  clinicInstitutionCode?: string | null
  /** 직원이 고른 본인부담여부. */
  chosenCopayCode?: string | null
  /** 직원이 고른 선택의료기관 기호. */
  chosenInstitutionCode?: string | null
  patient?: IdentityPatient
  /** 이번 접수에서 본인확인을 했는지. */
  identityVerified?: boolean
  autoInsurance?: AutoInsuranceGuarantee | null
  /** 예약에서 접수할 때 그 예약의 날짜 `YYYY-MM-DD`. */
  appointmentDate?: string | null
}

/** 접수를 막는 오류 코드입니다. 모두 422입니다. */
export type CheckInErrorCode =
  | 'NHIS_NOT_ELIGIBLE'
  | 'NHIS_BENEFIT_RESTRICTED'
  | 'SELECTED_INSTITUTION_REQUIRED'
  | 'IDENTITY_VERIFICATION_REQUIRED'
  | 'AUTO_INSURANCE_LIMIT_EXCEEDED'
  | 'AUTO_INSURANCE_CASE_EXPIRED'
  | 'APPOINTMENT_NOT_TODAY'

/** 접수 검증 결과입니다. */
export interface CheckInValidation {
  /** 접수를 막는 오류. 검사 순서대로 모두 담습니다. */
  errors: CheckInErrorCode[]
  /** 체납(`02`·`03`) 급여제한자입니다. 접수는 되지만 전액 수납하고 청구를 보냅니다. */
  benefitRestricted: boolean
  /** 저장할 선택의료기관 기호. 의뢰 코드(`B005`/`B006`/`B008`)가 아니면 비웁니다. */
  selectedInstitutionCode: string | null
}
