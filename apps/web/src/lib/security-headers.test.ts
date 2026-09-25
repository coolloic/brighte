import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, STATIC_SECURITY_HEADERS } from "./security-headers";

const directives = (policy: string) => Object.fromEntries(policy.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1).join(" ")]));

describe("contentSecurityPolicy", () => {
  it("production: scripts and styles only with the nonce; no framing, plugins or foreign forms", () => {
    const csp = directives(contentSecurityPolicy({ nonce: "abc", development: false, https: true }));
    expect(csp["script-src"]).toBe("'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp["style-src"]).toBe("'self' 'nonce-abc'");
    expect(csp["frame-ancestors"]).toBe("'none'");
    expect(csp["object-src"]).toBe("'none'");
    expect(csp["form-action"]).toBe("'self'");
    expect(csp).toHaveProperty("upgrade-insecure-requests");
    expect(JSON.stringify(csp)).not.toMatch(/unsafe-(inline|eval)/);
  });

  it("development allows what next dev needs", () => {
    const csp = directives(contentSecurityPolicy({ nonce: "abc", development: true, https: false }));
    expect(csp["script-src"]).toContain("'unsafe-eval'");
    expect(csp["style-src"]).toBe("'self' 'unsafe-inline'");
  });

  it("doesn't upgrade requests on plain http (it would break http://localhost)", () => {
    expect(contentSecurityPolicy({ nonce: "abc", development: false, https: false })).not.toContain("upgrade-insecure-requests");
  });

  it("static headers cover sniffing, referrers, features and framing", () => {
    expect(STATIC_SECURITY_HEADERS.map((h) => h.key)).toEqual(["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "X-Frame-Options"]);
  });
});
