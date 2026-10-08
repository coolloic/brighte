import { expect, test, type Page } from "@playwright/test";
import { ADMIN, visitorIp } from "./support";

// A slow submit, done with the keyboard: signing in keeps focus where it was, announces the wait,
// and afterwards focus goes to the result.

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
});

/** Holds each form POST to `path` for 1.5 seconds. */
const slowDown = (page: Page, path: string) =>
  page.route(`**${path}`, async (route) => {
    if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
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
