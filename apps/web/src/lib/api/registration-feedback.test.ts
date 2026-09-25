import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { formatWait, registrationFeedback } from "./registration-feedback";

describe("registrationFeedback", () => {
  it("puts each invalid field's message next to that field, without the example the hint already shows", () => {
    const error = new ApiError("BAD_USER_INPUT", "Invalid input", {
      fields: { mobile: "Enter an Australian mobile number, e.g. 0412 345 678", postcode: "Enter a 4-digit postcode" },
    });
    expect(registrationFeedback(error)).toEqual({
      fieldErrors: { mobile: "Enter an Australian mobile number", postcode: "Enter a 4-digit postcode" },
    });
  });

  it("reports a service code the API rejected on the services field", () => {
    const error = new ApiError("BAD_USER_INPUT", "Invalid input", { fields: { services: "Unknown or unavailable service: drone" } });
    expect(registrationFeedback(error).fieldErrors).toEqual({ services: "Unknown or unavailable service: drone" });
  });

  it("falls back to an alert when no field the form shows is named", () => {
    const feedback = registrationFeedback(new ApiError("BAD_USER_INPUT", "Invalid input", { fields: { referrer: "Nope" } }));
    expect(feedback.fieldErrors).toBeUndefined();
    expect(feedback.alert).toMatchObject({ tone: "error", retryable: false });
  });

  it("shows an already-registered email on the email field", () => {
    expect(registrationFeedback(new ApiError("CONFLICT", "Email already registered")).fieldErrors).toEqual({
      email: "This email has already registered interest. Use a different email.",
    });
  });

  it("rate limited: a warning with the seconds to count down", () => {
    expect(registrationFeedback(new ApiError("TOO_MANY_REQUESTS", "Too many requests", { retryAfter: 120 })).alert).toEqual({
      tone: "warning",
      title: "Too many attempts",
      message: "Please wait 2 minutes and try again.",
      retryable: false,
      retryAfter: 120,
    });
    // Without retryAfter there's nothing to count down.
    expect(registrationFeedback(new ApiError("TOO_MANY_REQUESTS", "Too many requests")).alert).not.toHaveProperty("retryAfter");
  });

  it.each([
    [undefined, "a minute"],
    [1, "1 second"],
    [42, "42 seconds"],
    [60, "1 minute"],
    [61, "1 minute 1 second"],
    [125, "2 minutes 5 seconds"],
    [900, "15 minutes"],
  ])("formatWait(%s)", (seconds, text) => {
    expect(formatWait(seconds)).toBe(text);
  });

  it.each(["NETWORK_ERROR", "INTERNAL_SERVER_ERROR", "UNAUTHENTICATED"] as const)("%s: a retryable alert that hides the details", (code) => {
    const feedback = registrationFeedback(new ApiError(code, "connect ECONNREFUSED 127.0.0.1:4001"));
    expect(feedback.alert).toMatchObject({ tone: "error", title: "We couldn't send your registration", retryable: true });
    expect(JSON.stringify(feedback)).not.toContain("ECONNREFUSED");
  });
});
