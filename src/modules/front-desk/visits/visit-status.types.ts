/** Where a visit stands in the front-desk flow on the day of service. */
export type VisitStatus =
  | "WAITING"
  | "IN_TREATMENT"
  | "AWAITING_PAYMENT"
  | "COMPLETED"
  | "CANCELED";

/** Command that moves a visit between statuses, sent as `POST /visits/{id}:{command}`. */
export type VisitCommand =
  | "START_TREATMENT"
  | "RETURN_TO_WAITING"
  | "SEND_TO_CHECKOUT"
  | "CHECKOUT"
  | "REOPEN"
  | "CANCEL";

/** Inputs that change whether a transition is allowed. */
export interface VisitTransitionOptions {
  /** Whether a cancel also voids the visit's encounters, receipts and related records. */
  cascade?: boolean;
}

/** Error codes returned when a visit transition is refused. */
export type VisitTransitionErrorCode = "VISIT_TRANSITION_INVALID" | "VISIT_HAS_CLINICAL_DATA";

/** Outcome of evaluating a visit command against the current status. */
export type VisitTransitionResult =
  | { ok: true; to: VisitStatus }
  | { ok: false; code: VisitTransitionErrorCode };
