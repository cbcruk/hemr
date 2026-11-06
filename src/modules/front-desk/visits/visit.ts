import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'
import { EncounterId } from '../../clinical/encounters/encounter-id.ts'
import { TenantId } from '../../identity/identity.ts'
import { LocalDate, PatientId } from '../../patients/patient.ts'
import type { CheckInErrorCode } from './check-in-validation.types.ts'

/** 내원 ID입니다. 예: `vis_01J...` */
export const VisitId = Schema.String.pipe(Schema.refine((value): value is Id<'visit'> => isId('visit', value)))

/** 진료 당일 접수 흐름에서 내원이 있는 단계입니다. */
export const VisitStatus = Schema.Literals(['WAITING', 'IN_TREATMENT', 'AWAITING_PAYMENT', 'COMPLETED', 'CANCELED'])

/** 내원 상태를 옮기는 커맨드입니다. */
export const VisitCommand = Schema.Literals([
  'START_TREATMENT',
  'RETURN_TO_WAITING',
  'SEND_TO_CHECKOUT',
  'CHECKOUT',
  'REOPEN',
  'CANCEL',
])

/** 보험구분입니다. `docs/design/front-desk.md`의 용어 표를 따릅니다. */
export const Coverage = Schema.Literals(['NHIS', 'MEDICAL_AID', 'AUTO_INSURANCE', 'INDUSTRIAL_ACCIDENT', 'SELF_PAY'])

/** 접수 때 받은 공단 자격 조회 결과입니다. 코드는 공단이 정한 값 그대로입니다 (`NhisEligibility`). */
export const NhisEligibility = Schema.Struct({
  /** `자격여부`입니다. `1`–`6`은 건보, `7`·`8`은 의료급여입니다. */
  qualificationCode: Schema.String.check(Schema.isMaxLength(4)),
  /** `급여제한여부`입니다. */
  benefitRestrictionCode: Schema.NullOr(Schema.String.check(Schema.isMaxLength(4))),
  /** `본인부담여부`입니다. */
  copayCode: Schema.NullOr(Schema.String.check(Schema.isMaxLength(8))),
  /** 선택기관기호 1–4입니다. */
  selectedInstitutionCodes: Schema.Array(Schema.String.check(Schema.isMaxLength(20))).check(Schema.isMaxLength(4)),
  /** `본인확인예외여부`가 `Y`인지입니다. */
  identityExempt: Schema.Boolean,
})
export type NhisEligibility = typeof NhisEligibility.Type

/** 접수 때 판정한 자격입니다. */
export const VisitEligibility = Schema.Struct({
  /** 건보·의료급여는 자격 조회를 거쳐 `VERIFIED`, 그 밖의 보험구분은 `NOT_REQUIRED`입니다. */
  status: Schema.Literals(['VERIFIED', 'NOT_REQUIRED']),
  nhis: Schema.NullOr(NhisEligibility),
  /** 이번 접수에서 본인확인을 했는지입니다. 다음 접수의 6개월 판정에 씁니다. */
  identityVerified: Schema.Boolean,
  /** 체납(`02`·`03`) 급여제한자입니다. 접수는 되지만 전액 수납하고 청구를 보냅니다. */
  benefitRestricted: Schema.Boolean,
  /** 직원이 고른 본인부담여부입니다. */
  copayCode: Schema.NullOr(Schema.String),
  /** 저장한 선택의료기관 기호입니다. 의뢰 코드가 아니면 서버가 비웁니다. */
  selectedInstitutionCode: Schema.NullOr(Schema.String),
})
export type VisitEligibility = typeof VisitEligibility.Type

/** 본인부담·검사 예외에 쓰는 표시입니다. 나머지 표시(산정특례 등)는 쓰는 기능이 생길 때 더합니다. */
export const BenefitFlags = Schema.Struct({
  /** 본인부담 100%입니다. */
  fullSelfPay: Schema.Boolean,
  pregnant: Schema.Boolean,
})
export type BenefitFlags = typeof BenefitFlags.Type

/**
 * 진료 당일 환자의 내원입니다.
 *
 * 지금은 접수와 상태 커맨드에 필요한 필드만 두었습니다. 진료의·진료항목·예약은 그 모듈이 생길 때 더합니다. 전체 리소스는 `docs/design/front-desk.md`를 보세요.
 */
export const Visit = Schema.Struct({
  id: VisitId,
  /** 내원을 받은 병원입니다. 다른 병원의 내원은 없는 것과 같이 다룹니다(404). */
  tenantId: TenantId,
  patientId: PatientId,
  /** 진료일입니다. 형식은 `YYYY-MM-DD`입니다. */
  date: LocalDate,
  /** 접수한 시각입니다. 목록은 이 순서입니다. */
  checkedInAt: Schema.String,
  coverage: Coverage,
  /** 초진인지입니다. 취소하지 않은 이전 내원이 없으면 초진으로 서버가 정합니다. */
  isFirstVisit: Schema.Boolean,
  eligibility: VisitEligibility,
  benefitFlags: BenefitFlags,
  /** 접수 때 함께 만든 진료입니다. 진료가 생기기 전(마이그레이션 `0007` 전)에 접수한 내원은 `null`입니다. */
  encounterId: Schema.NullOr(EncounterId),
  status: VisitStatus,
  statusChangedAt: Schema.String,
  /** 마지막 `:reopen` 또는 `:cancel`에서 받은 사유입니다. */
  statusReason: Schema.optionalKey(Schema.String),
  /**
   * 진료 내용이나 수납 기록이 있는지 여부입니다. 있으면 `cascade` 없이 취소할 수 없습니다.
   *
   * 수납 모듈이 생기기 전까지 저장된 값으로 둡니다. 진료 내용은 상태 커맨드가 진료에서 따로 읽어 더합니다
   * (`Visits.apply`). 수납이 생기면 두 모듈에서 파생합니다.
   */
  hasClinicalData: Schema.Boolean,
  /** 낙관적 잠금 버전입니다. 응답의 `ETag`로 주고 `If-Match`로 받습니다. */
  version: Schema.Int,
})

export type Visit = typeof Visit.Type

/** 요청한 ID의 내원이 없습니다. */
export class VisitNotFound extends HttpApiError.Problem<VisitNotFound>()(
  'VisitNotFound',
  { type: problemType('VISIT_NOT_FOUND'), status: 404, title: 'Visit not found' },
  { code: Schema.tag('VISIT_NOT_FOUND') },
) {}

/** 내원의 현재 상태에서는 이 커맨드를 보낼 수 없습니다. */
export class VisitTransitionInvalid extends HttpApiError.Problem<VisitTransitionInvalid>()(
  'VisitTransitionInvalid',
  { type: problemType('VISIT_TRANSITION_INVALID'), status: 409, title: 'Visit status does not allow this command' },
  { code: Schema.tag('VISIT_TRANSITION_INVALID'), currentStatus: VisitStatus, command: VisitCommand },
) {}

/**
 * 유효한 영수증이 있는 내원을 연쇄 취소하려 했습니다. 영수증 취소(#35)가 생길 때까지 먼저 영수증을 정리해야 합니다.
 */
export class VisitHasReceipt extends HttpApiError.Problem<VisitHasReceipt>()(
  'VisitHasReceipt',
  { type: problemType('VISIT_HAS_RECEIPT'), status: 409, title: 'Visit has an active receipt' },
  { code: Schema.tag('VISIT_HAS_RECEIPT'), receiptId: Schema.String },
) {}

/** 진료나 수납 기록이 있는 내원을 `cascade` 없이 취소하려 했습니다. */
export class VisitHasClinicalData extends HttpApiError.Problem<VisitHasClinicalData>()(
  'VisitHasClinicalData',
  { type: problemType('VISIT_HAS_CLINICAL_DATA'), status: 409, title: 'Visit has clinical data' },
  { code: Schema.tag('VISIT_HAS_CLINICAL_DATA'), currentStatus: VisitStatus },
) {}

/** 지난 날짜의 내원에 진료 흐름 커맨드를 보냈습니다. 수납·다시 열기·취소만 받습니다. */
export class VisitDatePast extends HttpApiError.Problem<VisitDatePast>()(
  'VisitDatePast',
  { type: problemType('VISIT_DATE_PAST'), status: 422, title: 'Visit date has passed' },
  { code: Schema.tag('VISIT_DATE_PAST'), date: Schema.String },
) {}

/** 같은 ID의 내원이 이미 있습니다. 응답을 받지 못해 다시 보냈다면 `GET /visits/{id}`로 확인합니다. */
export class VisitAlreadyExists extends HttpApiError.Problem<VisitAlreadyExists>()(
  'VisitAlreadyExists',
  { type: problemType('VISIT_ALREADY_EXISTS'), status: 409, title: 'Visit already exists' },
  { code: Schema.tag('VISIT_ALREADY_EXISTS') },
) {}

/** 접수 검증(`validateCheckIn`)이 막았습니다. `errors`는 검사 순서대로 모든 이유입니다. */
export class CheckInRejected extends HttpApiError.Problem<CheckInRejected>()(
  'CheckInRejected',
  { type: problemType('CHECK_IN_REJECTED'), status: 422, title: 'Check-in rejected' },
  {
    code: Schema.tag('CHECK_IN_REJECTED'),
    errors: Schema.Array(
      Schema.Literals([
        'NHIS_NOT_ELIGIBLE',
        'NHIS_BENEFIT_RESTRICTED',
        'SELECTED_INSTITUTION_REQUIRED',
        'IDENTITY_VERIFICATION_REQUIRED',
        'AUTO_INSURANCE_LIMIT_EXCEEDED',
        'AUTO_INSURANCE_CASE_EXPIRED',
        'APPOINTMENT_NOT_TODAY',
      ] satisfies ReadonlyArray<CheckInErrorCode>),
    ),
  },
) {}
