import { expect, test, type Page } from "@playwright/test";
import { visitorIp } from "./support";

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

test("the CSP blocks nothing on the 404", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sorry, we can't find that page");
  expect(await violations(page)).toEqual([]);
});

test("the CSP blocks nothing in the chat, including a match report, a profile and a tailored CV", async ({ page }) => {
  await page.goto("/");
  // A match block is validated in the browser (Zod): it must not try eval, which the CSP refuses.
  await page.getByRole("textbox", { name: "Message" }).fill("How well do I fit? [match]");
  await page.getByRole("textbox", { name: "Message" }).press("Enter");
  await expect(page.getByRole("heading", { level: 3, name: "Front-end Engineer · Acme" })).toBeVisible();
  // The report shows before the reply ends, and Enter doesn't send while a reply streams.
  await expect(page.getByRole("log", { name: "Conversation" })).toHaveAttribute("aria-busy", "false");
  await page.getByRole("textbox", { name: "Message" }).fill("Read my CV into a profile [profile]");
  await page.getByRole("textbox", { name: "Message" }).press("Enter");
  await expect(page.getByRole("heading", { level: 3, name: "Jane Citizen" })).toBeVisible();
  await expect(page.getByRole("log", { name: "Conversation" })).toHaveAttribute("aria-busy", "false");
  await page.getByRole("textbox", { name: "Message" }).fill("Tailor my CV [tailored]");
  await page.getByRole("textbox", { name: "Message" }).press("Enter");
  await expect(page.getByRole("heading", { level: 3, name: "Tailored for Senior Front-end Engineer · Brightpath" })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("the CSP blocks nothing while previewing a CV PDF", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The dialog preview is desktop-only");
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message" }).fill("Read my CV into a profile [profile]");
  await page.getByRole("textbox", { name: "Message" }).press("Enter");
  await expect(page.getByRole("log", { name: "Conversation" })).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Preview PDF" }).click();
  await expect(page.getByRole("dialog", { name: "CV preview" })).toBeVisible();
  // Give the frame a moment to load the PDF viewer.
  await page.waitForTimeout(1000);
  expect(await violations(page)).toEqual([]);
});
