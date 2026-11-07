import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'
import { EncounterId } from '../../clinical/encounters/encounter-id.ts'
import { TenantId } from '../../identity/identity.ts'
import { LocalDate, PatientId } from '../../patients/patient.ts'
import type { CheckInErrorCode } from './check-in-validation.types.ts'

// 설명은 `refine` 앞에 답니다. 뒤에 달면 OpenAPI 문서에서 빠집니다
export const VisitId = Schema.String.annotate({ description: '내원 ID입니다. 예: `vis_01J...`' }).pipe(
  Schema.refine((value): value is Id<'visit'> => isId('visit', value)),
)

export const VisitStatus = Schema.Literals([
  'WAITING',
  'IN_TREATMENT',
  'AWAITING_PAYMENT',
  'COMPLETED',
  'CANCELED',
]).annotate({
  identifier: 'VisitStatus',
  title: '내원 상태',
  description:
    '진료 당일 접수 흐름의 단계입니다. 대기(`WAITING`), 진료중(`IN_TREATMENT`), 수납대기(`AWAITING_PAYMENT`), 수납완료(`COMPLETED`), 취소(`CANCELED`)입니다. `COMPLETED`는 수납완료이고 진료 완료와 다릅니다.',
})

export const VisitCommand = Schema.Literals([
  'START_TREATMENT',
  'RETURN_TO_WAITING',
  'SEND_TO_CHECKOUT',
  'CHECKOUT',
  'REOPEN',
  'CANCEL',
]).annotate({
  identifier: 'VisitCommand',
  description:
    '내원 상태를 옮기는 커맨드입니다. 진료 시작, 대기로 되돌리기, 수납으로 보내기, 수납, 다시 열기(수납 뒤), 취소입니다.',
})

export const Coverage = Schema.Literals([
  'NHIS',
  'MEDICAL_AID',
  'AUTO_INSURANCE',
  'INDUSTRIAL_ACCIDENT',
  'SELF_PAY',
]).annotate({
  identifier: 'Coverage',
  title: '보험구분',
  description:
    '건보(`NHIS`), 의료급여(`MEDICAL_AID`), 자보(`AUTO_INSURANCE`), 산재(`INDUSTRIAL_ACCIDENT`), 일반(`SELF_PAY`)입니다.',
})

export const NhisEligibility = Schema.Struct({
  qualificationCode: Schema.String.check(Schema.isMaxLength(4)).annotate({
    description: '자격여부입니다. `1`–`6`은 건보, `7`·`8`은 의료급여입니다.',
  }),
  benefitRestrictionCode: Schema.NullOr(Schema.String.check(Schema.isMaxLength(4))).annotate({
    description: '급여제한여부입니다.',
  }),
  copayCode: Schema.NullOr(Schema.String.check(Schema.isMaxLength(8))).annotate({ description: '본인부담여부입니다.' }),
  selectedInstitutionCodes: Schema.Array(Schema.String.check(Schema.isMaxLength(20)))
    .check(Schema.isMaxLength(4))
    .annotate({ description: '선택기관기호 1–4입니다.' }),
  identityExempt: Schema.Boolean.annotate({ description: '본인확인예외여부가 `Y`인지입니다.' }),
}).annotate({
  identifier: 'NhisEligibility',
  description: '접수 때 받은 공단 자격 조회 결과입니다. 코드는 공단이 정한 값 그대로입니다.',
})
export type NhisEligibility = typeof NhisEligibility.Type

export const VisitEligibility = Schema.Struct({
  status: Schema.Literals(['VERIFIED', 'NOT_REQUIRED']).annotate({
    description: '건보·의료급여는 자격 조회를 거쳐 `VERIFIED`, 그 밖의 보험구분은 `NOT_REQUIRED`입니다.',
  }),
  nhis: Schema.NullOr(NhisEligibility),
  identityVerified: Schema.Boolean.annotate({
    description: '이번 접수에서 본인확인을 했는지입니다. 다음 접수의 6개월 판정에 씁니다.',
  }),
  benefitRestricted: Schema.Boolean.annotate({
    description: '체납(`02`·`03`) 급여제한자입니다. 접수는 되지만 전액 수납하고 청구를 보냅니다.',
  }),
  copayCode: Schema.NullOr(Schema.String).annotate({ description: '직원이 고른 본인부담여부입니다.' }),
  selectedInstitutionCode: Schema.NullOr(Schema.String).annotate({
    description: '저장한 선택의료기관 기호입니다. 의뢰 코드가 아니면 서버가 비웁니다.',
  }),
}).annotate({ identifier: 'VisitEligibility', title: '자격', description: '접수 때 판정한 자격입니다.' })
export type VisitEligibility = typeof VisitEligibility.Type

// 나머지 표시(산정특례 등)는 쓰는 기능이 생길 때 더합니다
export const BenefitFlags = Schema.Struct({
  fullSelfPay: Schema.Boolean.annotate({ description: '본인부담 100%입니다.' }),
  pregnant: Schema.Boolean.annotate({ description: '임신부입니다.' }),
}).annotate({ identifier: 'BenefitFlags', description: '본인부담·검사 예외에 쓰는 표시입니다.' })
export type BenefitFlags = typeof BenefitFlags.Type

// 지금은 접수와 상태 커맨드에 필요한 필드만 두었습니다. 진료의·진료항목·예약은 그 모듈이 생길 때 더합니다
export const Visit = Schema.Struct({
  id: VisitId,
  // 다른 병원의 내원은 없는 것과 같이 다룹니다(404)
  tenantId: TenantId,
  patientId: PatientId,
  date: LocalDate.annotate({ description: '진료일입니다. 형식은 `YYYY-MM-DD`입니다.' }),
  checkedInAt: Schema.String.annotate({ description: '접수한 시각입니다. 목록은 이 순서입니다.' }),
  coverage: Coverage,
  isFirstVisit: Schema.Boolean.annotate({
    description: '초진인지입니다. 취소하지 않은 이전 내원이 없으면 초진으로 서버가 정합니다.',
  }),
  eligibility: VisitEligibility,
  benefitFlags: BenefitFlags,
  // 마이그레이션 `0007` 전에 접수한 내원이 `null`입니다
  encounterId: Schema.NullOr(EncounterId).annotate({
    description: '접수 때 함께 만든 진료입니다. 진료 기능이 생기기 전에 접수한 내원은 `null`입니다.',
  }),
  status: VisitStatus,
  statusChangedAt: Schema.String.annotate({ description: '상태가 마지막으로 바뀐 시각입니다.' }),
  statusReason: Schema.optionalKey(
    Schema.String.annotate({ description: '마지막 `:reopen` 또는 `:cancel`에서 받은 사유입니다.' }),
  ),
  // 수납 모듈이 생기기 전까지 저장된 값으로 둡니다. 진료 내용은 상태 커맨드가 진료에서 따로 읽어 더합니다
  // (`Visits.apply`). 수납이 생기면 두 모듈에서 파생합니다
  hasClinicalData: Schema.Boolean.annotate({
    description:
      '저장된 진료·수납 기록 표시입니다. 진료 내용은 여기에 늘 반영되지 않아 `false`여도 취소가 409 `VISIT_HAS_CLINICAL_DATA`일 수 있습니다. 취소 판정은 서버가 진료 내용을 더해 합니다.',
  }),
  version: Schema.Int.annotate({
    description: '낙관적 잠금 버전입니다. 응답의 `ETag`로 주고 `If-Match`로 받습니다.',
  }),
}).annotate({
  identifier: 'Visit',
  title: '내원',
  description: '진료 당일 환자의 내원입니다. 전체 리소스는 `docs/design/front-desk.md`를 보세요.',
})

export type Visit = typeof Visit.Type

export class VisitNotFound extends HttpApiError.Problem<VisitNotFound>()(
  'VisitNotFound',
  { type: problemType('VISIT_NOT_FOUND'), status: 404, title: 'Visit not found' },
  { code: Schema.tag('VISIT_NOT_FOUND') },
  { description: '`VISIT_NOT_FOUND`: 요청한 ID의 내원이 없습니다. 다른 병원의 내원도 없는 것과 같습니다.' },
) {}

export class VisitTransitionInvalid extends HttpApiError.Problem<VisitTransitionInvalid>()(
  'VisitTransitionInvalid',
  { type: problemType('VISIT_TRANSITION_INVALID'), status: 409, title: 'Visit status does not allow this command' },
  { code: Schema.tag('VISIT_TRANSITION_INVALID'), currentStatus: VisitStatus, command: VisitCommand },
  { description: '`VISIT_TRANSITION_INVALID`: 내원의 현재 상태에서는 이 커맨드를 보낼 수 없습니다.' },
) {}

export class VisitHasClinicalData extends HttpApiError.Problem<VisitHasClinicalData>()(
  'VisitHasClinicalData',
  { type: problemType('VISIT_HAS_CLINICAL_DATA'), status: 409, title: 'Visit has clinical data' },
  { code: Schema.tag('VISIT_HAS_CLINICAL_DATA'), currentStatus: VisitStatus },
  { description: '`VISIT_HAS_CLINICAL_DATA`: 진료나 수납 기록이 있는 내원을 `cascade` 없이 취소하려 했습니다.' },
) {}

export class VisitDatePast extends HttpApiError.Problem<VisitDatePast>()(
  'VisitDatePast',
  { type: problemType('VISIT_DATE_PAST'), status: 422, title: 'Visit date has passed' },
  { code: Schema.tag('VISIT_DATE_PAST'), date: Schema.String },
  {
    description:
      '`VISIT_DATE_PAST`: 지난 날짜의 내원에 진료 흐름 커맨드를 보냈습니다. 수납·다시 열기·취소만 받습니다. `date`는 내원 날짜입니다.',
  },
) {}

export class VisitAlreadyExists extends HttpApiError.Problem<VisitAlreadyExists>()(
  'VisitAlreadyExists',
  { type: problemType('VISIT_ALREADY_EXISTS'), status: 409, title: 'Visit already exists' },
  { code: Schema.tag('VISIT_ALREADY_EXISTS') },
  {
    description:
      '`VISIT_ALREADY_EXISTS`: 같은 ID의 내원이 이미 있습니다. 응답을 받지 못해 다시 보냈다면 `GET /visits/{id}`로 확인합니다.',
  },
) {}

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
  { description: '`CHECK_IN_REJECTED`: 접수 검증이 막았습니다. `errors`는 검사 순서대로 모든 이유입니다.' },
) {}
