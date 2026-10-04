import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows `limit` hits per window, per key, then says when to retry", () => {
    let time = 0;
    const take = createRateLimiter({ limit: 2, windowMs: 10_000, now: () => time });

    expect(take("a")).toEqual({ ok: true });
    expect(take("a")).toEqual({ ok: true });
    time = 4_000;
    expect(take("a")).toEqual({ ok: false, retryAfterSeconds: 6 });
    // Another visitor has their own count.
    expect(take("b")).toEqual({ ok: true });
    // A new window starts over.
    time = 10_000;
    expect(take("a")).toEqual({ ok: true });
  });
});
