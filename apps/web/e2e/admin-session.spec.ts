import { createHmac } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { signInAsAdmin, visitorIp } from "./support";

// Sliding sessions: src/proxy.ts renews an admin's token while they are active. The e2e API issues
// 9-minute tokens (playwright.config.ts), so every admin request is inside the renewal window.

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
});

const sessionCookie = async (context: BrowserContext) => (await context.cookies()).find((cookie) => cookie.name === "brighte_session");

/** An HS256 token signed with the API's JWT_SECRET (apps/api/.env, loaded by playwright.config.ts). */
function signToken(payload: object) {
  const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;
  return `${unsigned}.${createHmac("sha256", process.env.JWT_SECRET!).update(unsigned).digest("base64url")}`;
}

/** The seed admin's id, from the token the sign-in just set. */
const subjectOf = (token: string) => (JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as { sub: number }).sub;

test.describe("admin session", () => {
  test("an active session is renewed: a fresh cookie that lasts longer", async ({ page, context }) => {
    await signInAsAdmin(page);
    const first = (await sessionCookie(context))!;

    // Tokens are issued per second: wait so the renewed one differs.
    await page.waitForTimeout(1100);
    await page.getByRole("link", { name: "Pick-up" }).click();
    await expect(page).toHaveURL("/admin?service=pick-up");

    const renewed = (await sessionCookie(context))!;
    expect(renewed.value).not.toBe(first.value);
    expect(renewed).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    expect(renewed.expires).toBeGreaterThan(first.expires);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Leads");
  });

  test("an expired session goes to sign in, and back afterwards", async ({ page, context, baseURL }) => {
    await signInAsAdmin(page);
    const sub = subjectOf((await sessionCookie(context))!.value);
    const now = Math.floor(Date.now() / 1000);
    // Leave the dashboard first: its link prefetches renew the session, and a late response would
    // overwrite the cookie set below.
    await page.goto("about:blank");
    await context.clearCookies();
    await context.addCookies([
      { name: "brighte_session", value: signToken({ sub, role: "ADMIN", auth_time: now - 3600, iat: now - 1800, exp: now - 60 }), url: baseURL! },
    ]);

    await page.goto("/admin?service=payment");
    await expect(page).toHaveURL(`/admin/login?next=${encodeURIComponent("/admin?service=payment")}`);
  });

  test("a session past its 8-hour limit isn't renewed", async ({ page, context, baseURL }) => {
    await signInAsAdmin(page);
    const sub = subjectOf((await sessionCookie(context))!.value);
    const now = Math.floor(Date.now() / 1000);
    // Signed in 9 hours ago; the token itself has 5 minutes left.
    const old = signToken({ sub, role: "ADMIN", auth_time: now - 9 * 3600, iat: now - 60, exp: now + 300 });
    await page.goto("about:blank"); // no dashboard requests still in flight (see above)
    await context.clearCookies();
    await context.addCookies([{ name: "brighte_session", value: old, url: baseURL! }]);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Leads");
    // Still usable until it expires, but not extended: the next visit after that means signing in.
    expect((await sessionCookie(context))!.value).toBe(old);
  });
});
