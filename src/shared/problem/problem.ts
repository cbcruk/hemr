import type { ProblemDetails, ProblemInit, Violation } from "./problem.types.ts";

/** Media type of RFC 9457 error responses. */
export const PROBLEM_CONTENT_TYPE = "application/problem+json";

/** Error thrown by domain code and rendered as an RFC 9457 response. */
export class ProblemError extends Error {
  /** HTTP status code of the response. */
  readonly status: number;
  /** Machine-readable error code in `SCREAMING_SNAKE_CASE`. */
  readonly code: string;
  /** Short, stable summary of the problem type. */
  readonly title: string;
  /** Developer-facing explanation of this occurrence. */
  readonly detail: string | undefined;
  /** Field-level failures, when the problem is a validation error. */
  readonly violations: Violation[] | undefined;

  /** Creates a problem error from its response fields. */
  constructor(init: ProblemInit) {
    super(init.detail ?? init.title);
    this.name = "ProblemError";
    this.status = init.status;
    this.code = init.code;
    this.title = init.title;
    this.detail = init.detail;
    this.violations = init.violations;
  }

  /** Serializes the error into a Problem Details response body. */
  toJSON(): ProblemDetails {
    return {
      type: problemType(this.code),
      title: this.title,
      status: this.status,
      code: this.code,
      ...(this.detail === undefined ? {} : { detail: this.detail }),
      ...(this.violations === undefined ? {} : { violations: this.violations }),
    };
  }
}

/** Builds the `type` URI for an error code, such as `urn:hemr:problem:slot-full`. */
export function problemType(code: string): string {
  return `urn:hemr:problem:${code.toLowerCase().replaceAll("_", "-")}`;
}
