import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { signInFeedback } from "./sign-in-feedback";

describe("signInFeedback", () => {
  it("gives one message for any wrong email or password", () => {
    expect(signInFeedback(new ApiError("UNAUTHENTICATED", "Invalid email or password"))).toEqual({
      tone: "error",
      title: "Email or password is incorrect",
      message: "Check them and try again.",
    });
  });

  it("passes the wait on when rate limited", () => {
    expect(signInFeedback(new ApiError("TOO_MANY_REQUESTS", "Too many requests", { retryAfter: 120 }))).toMatchObject({
      tone: "warning",
      title: "Too many attempts",
      retryAfter: 120,
    });
    expect(signInFeedback(new ApiError("TOO_MANY_REQUESTS", "Too many requests"))).not.toHaveProperty("retryAfter");
  });

  it.each(["NETWORK_ERROR", "INTERNAL_SERVER_ERROR", "BAD_USER_INPUT"] as const)("%s: a generic message without details", (code) => {
    const alert = signInFeedback(new ApiError(code, "connect ECONNREFUSED 127.0.0.1:4001"));
    expect(alert.title).toBe("We couldn't sign you in");
    expect(JSON.stringify(alert)).not.toContain("ECONNREFUSED");
  });
});
