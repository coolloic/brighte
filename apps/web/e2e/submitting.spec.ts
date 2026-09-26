import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, visitorIp } from "./support";

// A slow submit, done with the keyboard. Registering confirms at once (optimistic) and puts it
// right if the server says otherwise; signing in keeps focus where it was, announces the wait, and
// afterwards focus goes to the result.

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
});

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
}

/** Holds each form POST to `path` for 1.5 seconds. */
const slowDown = (page: Page, path: string) =>
  page.route(`**${path}`, async (route) => {
    if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

async function fillRegistration(page: Page, email: string) {
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mobile number").fill("0412 345 678");
  await page.getByLabel("Postcode").fill("2000");
  await page.getByRole("checkbox", { name: "Delivery" }).check();
}

/** Presses Enter on the submit button; resolves with the server's answer to the POST. */
async function registerWithKeyboard(page: Page) {
  const answered = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: "Register interest" }).focus();
  await page.keyboard.press("Enter");
  return answered;
}

test("registering: the confirmation shows at once and stays once the server confirms", async ({ page }) => {
  await slowDown(page, "/");
  await page.goto("/");
  await fillRegistration(page, `e2e-${randomUUID()}@example.com`);
  const answered = registerWithKeyboard(page);

  // Before the (held) POST is answered.
  const confirmation = page.getByRole("heading", { name: "Thanks, you're registered" });
  await expect(confirmation).toBeFocused({ timeout: 1000 });
  await answered;
  await expect(confirmation).toBeFocused();
});

test("registering: an early confirmation gives way to the server's answer, keeping what was typed", async ({ page }) => {
  // Register the email first, so the next submit is a duplicate (CONFLICT).
  const email = `e2e-${randomUUID()}@example.com`;
  await page.goto("/");
  await fillRegistration(page, email);
  await registerWithKeyboard(page);

  await slowDown(page, "/");
  await page.goto("/");
  await fillRegistration(page, email);
  const answered = registerWithKeyboard(page);
  const confirmation = page.getByRole("heading", { name: "Thanks, you're registered" });
  await expect(confirmation).toBeVisible({ timeout: 1000 });

  await answered;
  await expect(confirmation).toHaveCount(0);
  const emailField = page.getByLabel("Email");
  await expect(emailField).toBeFocused();
  await expect(emailField).toHaveAccessibleDescription("This email has already registered interest. Use a different email.");
  await expect(emailField).toHaveValue(email);
  await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace");
  await expect(page.getByRole("checkbox", { name: "Delivery" })).toBeChecked();
  await expectNoA11yViolations(page);
});

test("signing in: the password field keeps focus and the wait is announced", async ({ page }) => {
  await slowDown(page, "/admin/login");
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  const password = page.getByLabel(/^Password/);
  await password.fill("not-the-password");
  await password.press("Enter");

  await expect(page.getByRole("button", { name: "Signing in…" })).toHaveAttribute("aria-disabled", "true");
  await expect(password).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Signing in…" })).toBeAttached();

  // A wrong password: the alert is announced and focus is on the (cleared) password.
  await expect(page.getByRole("alert").filter({ hasText: "Email or password is incorrect" })).toBeVisible();
  await expect(password).toBeFocused();
});
