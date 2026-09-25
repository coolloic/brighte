import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { registerLead, signInAsAdmin, visitorIp } from "./support";

// The web app's security headers (src/proxy.ts, next.config.ts), and that the strict CSP doesn't
// block anything the app itself needs.

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
  // Record every CSP violation the browser reports, from the first script on.
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { cspViolations: string[] }).cspViolations = violations;
    document.addEventListener("securitypolicyviolation", (event) => violations.push(`${event.violatedDirective} ${event.blockedURI}`));
  });
});

const violations = (page: Page) => page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);

test("pages send the security headers, with a fresh CSP nonce each time", async ({ request }) => {
  const first = await request.get("/");
  const headers = first.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[\w+/=]+' 'strict-dynamic'/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).not.toContain("unsafe-inline");
  expect(headers).toMatchObject({
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
  });
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers).not.toHaveProperty("x-powered-by");

  const nonce = (h: Record<string, string>) => /'nonce-([^']+)'/.exec(h["content-security-policy"])![1];
  expect(nonce((await request.get("/")).headers())).not.toBe(nonce(headers));
  // Every script Next renders carries this response's nonce.
  const html = await first.text();
  const scripts = [...html.matchAll(/<script(?![^>]*application\/ld\+json)[^>]*>/g)].map((m) => m[0]);
  expect(scripts.length).toBeGreaterThan(0);
  for (const tag of scripts) expect(tag).toContain(`nonce="${nonce(headers)}"`);
});

test("the CSP blocks nothing while registering", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Register interest" }).click(); // browser-side validation
  await expect(page.getByLabel("Full name")).toBeFocused();
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(`e2e-${randomUUID()}@example.com`);
  await page.getByLabel("Mobile number").fill("0412 345 678");
  await page.getByLabel("Postcode").fill("2000");
  await page.getByRole("checkbox", { name: "Delivery" }).check();
  await page.getByRole("button", { name: "Register interest" }).click();
  await expect(page.getByRole("heading", { name: "Thanks, you're registered" })).toBeFocused();
  expect(await violations(page)).toEqual([]);
});

test("the CSP blocks nothing on the admin pages and the 404", async ({ page }) => {
  const lead = await registerLead({ name: `Csp ${Date.now().toString(36)}` });
  await signInAsAdmin(page);
  await page.getByRole("searchbox", { name: "Search leads" }).fill(lead.name);
  await expect(page.getByRole("link", { name: lead.name })).toBeVisible();
  await page.getByRole("link", { name: lead.name }).click();
  await expect(page.getByRole("complementary", { name: "Selected lead" })).toContainText(lead.email);
  await page.locator("header summary").click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sorry, we can't find that page");
  expect(await violations(page)).toEqual([]);
});
