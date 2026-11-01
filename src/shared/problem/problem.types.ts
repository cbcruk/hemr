/** A single field-level validation failure inside a problem response. */
export interface Violation {
  /** JSON path of the offending field, such as `startAt` or `payments[0].amount`. */
  field: string;
  /** Machine-readable reason in `SCREAMING_SNAKE_CASE`. */
  code: string;
}

/**
 * Error response body following RFC 9457 Problem Details.
 *
 * Clients pick user-facing text by `code`; `detail` is for developers.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  violations?: Violation[];
}

/** Options for constructing a {@linkcode ProblemError}. */
export interface ProblemInit {
  status: number;
  code: string;
  title: string;
  detail?: string;
  violations?: Violation[];
}
