import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, visitorIp } from "./support";

// A slow submit, done with the keyboard: focus must stay where it was (not drop to the page), the
// wait must be announced, and afterwards focus goes to the result.

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
});

/** Holds each form POST to `path` for 1.5 seconds. */
const slowDown = (page: Page, path: string) =>
  page.route(`**${path}`, async (route) => {
    if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

test("registering: the button keeps focus and the wait is announced", async ({ page }) => {
  await slowDown(page, "/");
  await page.goto("/");
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(`e2e-${randomUUID()}@example.com`);
  await page.getByLabel("Mobile number").fill("0412 345 678");
  await page.getByLabel("Postcode").fill("2000");
  await page.getByRole("checkbox", { name: "Delivery" }).check();

  const button = page.getByRole("button", { name: "Register interest" });
  await button.focus();
  await page.keyboard.press("Enter");

  const busy = page.getByRole("button", { name: "Submitting…" });
  await expect(busy).toBeFocused();
  await expect(busy).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("status").filter({ hasText: "Submitting your registration…" })).toBeAttached();
  // Enter again does nothing while it's on its way.
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Thanks, you're registered" })).toBeFocused();
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
