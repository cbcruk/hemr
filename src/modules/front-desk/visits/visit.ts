import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'
import { TenantId } from '../../identity/identity.ts'

/** 내원 ID입니다. 예: `vis_01J...` */
export const VisitId = Schema.String.pipe(Schema.refine((value): value is Id<'visit'> => isId('visit', value)))

/** 환자 ID입니다. 예: `pat_01J...` */
export const PatientId = Schema.String.pipe(Schema.refine((value): value is Id<'patient'> => isId('patient', value)))

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

/**
 * 진료 당일 환자의 내원입니다.
 *
 * 지금은 상태 커맨드에 필요한 필드만 두었습니다. 전체 리소스는
 * `docs/design/front-desk.md`를 보세요.
 */
export const Visit = Schema.Struct({
  id: VisitId,
  /** 내원을 받은 병원입니다. 다른 병원의 내원은 없는 것과 같이 다룹니다(404). */
  tenantId: TenantId,
  patientId: PatientId,
  /** 진료일입니다. 형식은 `YYYY-MM-DD`입니다. */
  date: Schema.String,
  status: VisitStatus,
  statusChangedAt: Schema.String,
  /** 마지막 `:reopen` 또는 `:cancel`에서 받은 사유입니다. */
  statusReason: Schema.optionalKey(Schema.String),
  /**
   * 진료 내용이나 수납 기록이 있는지 여부입니다. 있으면 `cascade` 없이 취소할 수 없습니다.
   *
   * 진료·수납 모듈이 생기기 전까지 저장된 값으로 둡니다. 그 뒤에는 두 모듈에서 파생합니다.
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
