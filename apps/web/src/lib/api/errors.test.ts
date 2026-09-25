import { describe, expect, it } from "vitest";
import { toApiError } from "./errors";

describe("toApiError", () => {
  it("keeps the code, field messages and retryAfter", () => {
    const error = toApiError({
      message: "Invalid input",
      extensions: { code: "BAD_USER_INPUT", fields: { postcode: "Enter a 4-digit postcode" } },
    });
    expect(error).toMatchObject({ code: "BAD_USER_INPUT", message: "Invalid input", fields: { postcode: "Enter a 4-digit postcode" } });
    expect(toApiError({ message: "Slow down", extensions: { code: "TOO_MANY_REQUESTS", retryAfter: 42 } }).retryAfter).toBe(42);
  });

  it("treats a missing or unknown code as INTERNAL_SERVER_ERROR", () => {
    expect(toApiError({ message: "?" }).code).toBe("INTERNAL_SERVER_ERROR");
    expect(toApiError({ message: "?", extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }).code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("drops malformed extensions instead of trusting them", () => {
    const error = toApiError({ message: 1, extensions: { code: "BAD_USER_INPUT", fields: { name: 3 }, retryAfter: "soon" } });
    expect(error.message).toBe("Unknown API error");
    expect(error.fields).toBeUndefined();
    expect(error.retryAfter).toBeUndefined();
  });
});
