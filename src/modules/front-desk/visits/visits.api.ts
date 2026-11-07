import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import { Access } from '../../identity/auth/access.ts'
import { PermissionDenied } from '../../identity/auth/auth-errors.ts'
import { Authorization } from '../../identity/auth/authorization.ts'
import { LocalDate, PatientId, PatientNotFound } from '../../patients/patient.ts'
import { PaymentRefundRequired } from '../receipts/receipt.ts'
import {
  CheckInRejected,
  Coverage,
  Visit,
  VisitAlreadyExists,
  VisitDatePast,
  VisitHasClinicalData,
  VisitId,
  VisitNotFound,
  VisitStatus,
  VisitTransitionInvalid,
} from './visit.ts'

const params = { id: VisitId }
/** 다른 사람의 변경을 덮어쓰지 않도록 보내는 버전입니다. 예: `"7"` */
const headers = { 'if-match': Schema.optionalKey(Schema.String) }
/** 바뀐 내원과, 다음 요청의 `If-Match`에 쓸 `ETag`입니다. */
const success = HttpApiSchema.WithHeaders(Visit, { etag: Schema.String })
const errors = [VisitNotFound, VisitTransitionInvalid, VersionMismatch]
const flowErrors = [...errors, VisitDatePast]

/** 공단 자격 조회 결과입니다. 비어 있을 수 있는 코드는 빼고 보내도 됩니다. */
const EligibilityInput = Schema.Struct({
  qualificationCode: Schema.String.check(Schema.isMaxLength(4)),
  benefitRestrictionCode: Schema.optionalKey(Schema.NullOr(Schema.String.check(Schema.isMaxLength(4)))),
  copayCode: Schema.optionalKey(Schema.NullOr(Schema.String.check(Schema.isMaxLength(8)))),
  selectedInstitutionCodes: Schema.Array(Schema.String.check(Schema.isMaxLength(20))).check(Schema.isMaxLength(4)),
  identityExempt: Schema.optionalKey(Schema.Boolean),
})

/** 원 단위 금액입니다. */
const Won = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

/** 접수 본문입니다 (front-desk.md 접수 커맨드). 진료일은 서버가 오늘로 정합니다. */
const CheckInPayload = Schema.Struct({
  /** 엣지가 만든 내원 ID입니다. 없으면 서버가 만듭니다. */
  id: Schema.optionalKey(VisitId),
  patientId: PatientId,
  coverage: Coverage,
  /** 건보·의료급여 접수에 쓰는 자격 조회 결과입니다. 자격 조회 모듈이 생기면 `eligibilityLookupId`로 바꿉니다. */
  eligibility: Schema.optionalKey(Schema.NullOr(EligibilityInput)),
  /** 자보 지급보증입니다. 자보 사고 모듈이 생기면 `autoInsuranceCaseId`로 바꿉니다. */
  autoInsurance: Schema.optionalKey(
    Schema.NullOr(
      Schema.Struct({
        limit: Schema.NullOr(Won),
        accumulatedCost: Schema.NullOr(Won),
        endDate: Schema.optionalKey(Schema.NullOr(LocalDate)),
      }),
    ),
  ),
  benefitFlags: Schema.optionalKey(
    Schema.Struct({ fullSelfPay: Schema.optionalKey(Schema.Boolean), pregnant: Schema.optionalKey(Schema.Boolean) }),
  ),
  copayCode: Schema.optionalKey(Schema.NullOr(Schema.String.check(Schema.isMaxLength(8)))),
  selectedInstitutionCode: Schema.optionalKey(Schema.NullOr(Schema.String.check(Schema.isMaxLength(20)))),
  identityVerified: Schema.optionalKey(Schema.Boolean),
  initialStatus: Schema.optionalKey(Schema.Literals(['WAITING', 'IN_TREATMENT'])),
})

/**
 * 내원 접수·조회와 상태 커맨드입니다. 상태 커맨드는 `POST /visits/{id}:{command}`로 보냅니다.
 *
 * 접수는 `visit:check_in`, 조회는 `visit:read`가 필요합니다. 바로 진료로 접수(`initialStatus: IN_TREATMENT`)하면
 * `:start-treatment`와 같은 `visit:update`도 필요해 서비스(`Visits.checkIn`)가 더 확인합니다.
 *
 * 라우터는 `::`를 콜론 문자로 읽으므로 `/:id::cancel`이 `/vis_01J...:cancel`과 일치합니다.
 *
 * 진료 흐름과 다시 열기는 `visit:update`, 취소는 `visit:cancel`이 필요합니다. 연쇄 취소(`cascade: true`)는 본문에 따라
 * 정해지므로 `receipt:void`·`encounter:retract`를 서비스(`Visits.apply`)가 더 확인합니다 (D3).
 */
export class VisitsApi extends HttpApiGroup.make('visits')
  .add(
    HttpApiEndpoint.get('list', '/visits', {
      query: {
        /** 진료일입니다. 없으면 병원 시간대의 오늘입니다. */
        date: Schema.optionalKey(LocalDate),
        status: Schema.optionalKey(VisitStatus),
      },
      success: Schema.Struct({ items: Schema.Array(Visit) }),
    }).annotate(Access, Access.requires('visit:read')),
    HttpApiEndpoint.post('checkIn', '/visits::check-in', {
      payload: CheckInPayload,
      success: HttpApiSchema.WithHeaders(Visit, { etag: Schema.String }).pipe(HttpApiSchema.status(201)),
      error: [PatientNotFound, CheckInRejected, VisitAlreadyExists, PermissionDenied],
    })
      .annotate(Access, Access.requires('visit:check_in'))
      // 아직 받지 않는 필드(`date`·`appointmentId`·`newPatient` 등)를 조용히 버리지 않고 400으로 알립니다
      .annotate(HttpApi.PayloadParseOptions, { errors: 'all', onExcessProperty: 'error' }),
    HttpApiEndpoint.get('get', '/visits/:id', {
      params,
      success,
      error: VisitNotFound,
    }).annotate(Access, Access.requires('visit:read')),
    HttpApiEndpoint.post('startTreatment', '/visits/:id::start-treatment', {
      params,
      headers,
      success,
      error: flowErrors,
    }).annotate(Access, Access.requires('visit:update')),
    HttpApiEndpoint.post('returnToWaiting', '/visits/:id::return-to-waiting', {
      params,
      headers,
      success,
      error: flowErrors,
    }).annotate(Access, Access.requires('visit:update')),
    HttpApiEndpoint.post('sendToCheckout', '/visits/:id::send-to-checkout', {
      params,
      headers,
      success,
      error: flowErrors,
    }).annotate(Access, Access.requires('visit:update')),
    HttpApiEndpoint.post('reopen', '/visits/:id::reopen', {
      params,
      headers,
      payload: Schema.Struct({
        reason: Schema.NonEmptyString,
        /** 다시 연 뒤 이어서 옮길 상태입니다. 없으면 `AWAITING_PAYMENT`에 머뭅니다. */
        then: Schema.optionalKey(Schema.Literals(['WAITING', 'IN_TREATMENT'])),
      }),
      success,
      error: flowErrors,
    }).annotate(Access, Access.requires('visit:update')),
    HttpApiEndpoint.post('cancel', '/visits/:id::cancel', {
      params,
      headers,
      payload: Schema.Struct({ reason: Schema.NonEmptyString, cascade: Schema.optionalKey(Schema.Boolean) }),
      success,
      error: [...errors, VisitHasClinicalData, PaymentRefundRequired, PermissionDenied],
    }).annotate(Access, Access.requires('visit:cancel')),
  )
  .middleware(Authorization) {}
