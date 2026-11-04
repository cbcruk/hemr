import { describe, expect, it } from "vitest";
import { ProblemError } from "./problem.ts";

describe("ProblemError", () => {
  it("serializes to RFC 9457 fields and omits empty optionals", () => {
    const error = new ProblemError({ status: 409, code: "APPOINTMENT_SLOT_FULL", title: "Appointment slot is full" });

    expect(error.toJSON()).toEqual({
      type: "urn:hemr:problem:appointment-slot-full",
      title: "Appointment slot is full",
      status: 409,
      code: "APPOINTMENT_SLOT_FULL",
    });
  });
});
