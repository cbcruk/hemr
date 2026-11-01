import type {
  VisitCommand,
  VisitStatus,
  VisitTransitionOptions,
  VisitTransitionResult,
} from "./visit-status.types.ts";

interface Transition {
  to: VisitStatus;
  requiresCascade?: boolean;
}

const TRANSITIONS: Record<VisitStatus, Partial<Record<VisitCommand, Transition>>> = {
  WAITING: {
    START_TREATMENT: { to: "IN_TREATMENT" },
    SEND_TO_CHECKOUT: { to: "AWAITING_PAYMENT" },
    CHECKOUT: { to: "COMPLETED" },
    CANCEL: { to: "CANCELED" },
  },
  IN_TREATMENT: {
    RETURN_TO_WAITING: { to: "WAITING" },
    SEND_TO_CHECKOUT: { to: "AWAITING_PAYMENT" },
    CHECKOUT: { to: "COMPLETED" },
    CANCEL: { to: "CANCELED", requiresCascade: true },
  },
  AWAITING_PAYMENT: {
    START_TREATMENT: { to: "IN_TREATMENT" },
    RETURN_TO_WAITING: { to: "WAITING" },
    CHECKOUT: { to: "COMPLETED" },
    CANCEL: { to: "CANCELED" },
  },
  COMPLETED: {
    REOPEN: { to: "AWAITING_PAYMENT" },
    CANCEL: { to: "CANCELED", requiresCascade: true },
  },
  CANCELED: {},
};

/**
 * Evaluates a visit command against the current status and returns the next status.
 *
 * This is the server-side replacement for the client-only transition table of the
 * current app. It checks the state machine only; permission checks and data-level
 * blockers of a cascading cancel live in the command handlers.
 *
 * @example Cancel a visit that is already in treatment
 * ```ts
 * import { transitionVisit } from "./visit-status.ts";
 *
 * transitionVisit("IN_TREATMENT", "CANCEL"); // { ok: false, code: "VISIT_HAS_CLINICAL_DATA" }
 * transitionVisit("IN_TREATMENT", "CANCEL", { cascade: true }); // { ok: true, to: "CANCELED" }
 * ```
 */
export function transitionVisit(
  from: VisitStatus,
  command: VisitCommand,
  options: VisitTransitionOptions = {},
): VisitTransitionResult {
  const transition = TRANSITIONS[from][command];
  if (transition === undefined) return { ok: false, code: "VISIT_TRANSITION_INVALID" };
  if (transition.requiresCascade === true && options.cascade !== true) {
    return { ok: false, code: "VISIT_HAS_CLINICAL_DATA" };
  }
  return { ok: true, to: transition.to };
}

/**
 * Lists the commands available from a status, for the `allowedActions` field.
 *
 * Commands that need `cascade` are included, since the client offers them as an option.
 */
export function allowedVisitCommands(status: VisitStatus): VisitCommand[] {
  return Object.keys(TRANSITIONS[status]) as VisitCommand[];
}
