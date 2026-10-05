import { describe, expect, it } from "vitest";
import { cvPdfErrorMessage } from "./errors";

describe("cvPdfErrorMessage", () => {
  it("says how long to wait when rate limited", () => {
    expect(cvPdfErrorMessage({ code: "RATE_LIMITED", retryAfterSeconds: 30 })).toBe("You've made a lot of PDFs. Try again in 1 minute.");
    expect(cvPdfErrorMessage({ code: "RATE_LIMITED", retryAfterSeconds: 301 })).toBe("You've made a lot of PDFs. Try again in 6 minutes.");
  });
  it("explains blocking flags and unsupported characters", () => {
    expect(cvPdfErrorMessage({ code: "HAS_BLOCKING_FLAGS" })).toBe("Fix the things to check first.");
    expect(cvPdfErrorMessage({ code: "UNSUPPORTED_CHARACTERS", characters: ["✓", "中"] })).toBe(
      "This CV has characters the PDF font can't show: ✓ 中. Ask me to replace them, then download again.",
    );
  });
  it("falls back to a generic message", () => {
    expect(cvPdfErrorMessage({ code: "RENDER_FAILED" })).toBe("The PDF couldn't be made. Please try again.");
  });
});
