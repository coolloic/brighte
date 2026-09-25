import { describe, expect, it } from "vitest";
import { FixedWindowLimiter } from "./rate-limit";

describe("FixedWindowLimiter", () => {
  it("allows `limit` calls per key and window, then refuses until the next window", () => {
    let now = 0;
    const limiter = new FixedWindowLimiter(2, 60_000, () => now);
    expect([limiter.allow("a"), limiter.allow("a"), limiter.allow("a")]).toEqual([true, true, false]);
    expect(limiter.allow("b")).toBe(true);
    now = 60_000;
    expect(limiter.allow("a")).toBe(true);
  });
});
