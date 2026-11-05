import { Schema } from 'effect'
import { HttpApiError } from 'effect/http-api'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { problemType } from '../../../shared/problem/problem.ts'

/** Identifier of a visit, such as `vis_01J...`. */
export const VisitId = Schema.String.pipe(Schema.refine((value): value is Id<'visit'> => isId('visit', value)))

/** Identifier of a patient, such as `pat_01J...`. */
export const PatientId = Schema.String.pipe(Schema.refine((value): value is Id<'patient'> => isId('patient', value)))

/** Where a visit stands in the front-desk flow on the day of service. */
export const VisitStatus = Schema.Literals(['WAITING', 'IN_TREATMENT', 'AWAITING_PAYMENT', 'COMPLETED', 'CANCELED'])

/** Command that moves a visit between statuses. */
export const VisitCommand = Schema.Literals([
  'START_TREATMENT',
  'RETURN_TO_WAITING',
  'SEND_TO_CHECKOUT',
  'CHECKOUT',
  'REOPEN',
  'CANCEL',
])

/**
 * A patient's visit on the day of service.
 *
 * Only the fields the status commands need are modeled so far; see
 * `docs/design/front-desk.md` for the full resource.
 */
export const Visit = Schema.Struct({
  id: VisitId,
  patientId: PatientId,
  /** Day of service, as `YYYY-MM-DD`. */
  date: Schema.String,
  status: VisitStatus,
  statusChangedAt: Schema.String,
  /** Reason given by the last `:reopen` or `:cancel`. */
  statusReason: Schema.optionalKey(Schema.String),
})

export type Visit = typeof Visit.Type

/** No visit has the requested id. */
export class VisitNotFound extends HttpApiError.Problem<VisitNotFound>()(
  'VisitNotFound',
  { type: problemType('VISIT_NOT_FOUND'), status: 404, title: 'Visit not found' },
  { code: Schema.tag('VISIT_NOT_FOUND') },
) {}

/** The command is not allowed from the visit's current status. */
export class VisitTransitionInvalid extends HttpApiError.Problem<VisitTransitionInvalid>()(
  'VisitTransitionInvalid',
  { type: problemType('VISIT_TRANSITION_INVALID'), status: 409, title: 'Visit status does not allow this command' },
  { code: Schema.tag('VISIT_TRANSITION_INVALID'), currentStatus: VisitStatus, command: VisitCommand },
) {}

/** A cancel would discard encounters or receipts and was sent without `cascade`. */
export class VisitHasClinicalData extends HttpApiError.Problem<VisitHasClinicalData>()(
  'VisitHasClinicalData',
  { type: problemType('VISIT_HAS_CLINICAL_DATA'), status: 409, title: 'Visit has clinical data' },
  { code: Schema.tag('VISIT_HAS_CLINICAL_DATA'), currentStatus: VisitStatus },
) {}
