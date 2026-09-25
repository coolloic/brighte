import { describe, expect, it } from "vitest";
import { RENEW_WITHIN_SECONDS, sessionCookieOptions, shouldRenew, tokenExpiry } from "./session-cookie";

// Only the payload matters here: the API verifies signatures.
const token = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
const now = Date.UTC(2026, 8, 25, 9, 0, 0);
const inSeconds = (seconds: number) => Math.floor(now / 1000) + seconds;

describe("session cookie", () => {
  it("reads the token's expiry", () => {
    expect(tokenExpiry(token({ exp: inSeconds(60) }))).toEqual(new Date(now + 60_000));
    expect(tokenExpiry(token({}))).toBeUndefined();
    expect(tokenExpiry("not-a-jwt")).toBeUndefined();
  });

  it.each([
    ["30 minutes left", 30 * 60, false],
    ["just over the window", RENEW_WITHIN_SECONDS + 5, false],
    ["9 minutes left", 9 * 60, true],
    ["1 second left", 1, true],
    ["already expired", -1, false],
  ])("%s: renew = %s", (_, left, expected) => {
    expect(shouldRenew(token({ exp: inSeconds(left) }), now)).toBe(expected);
  });

  it("never renews a token it can't read", () => {
    expect(shouldRenew("not-a-jwt", now)).toBe(false);
  });

  it("expires the cookie with the token", () => {
    expect(sessionCookieOptions(token({ exp: inSeconds(1800) }))).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(now + 1_800_000),
    });
  });
});
