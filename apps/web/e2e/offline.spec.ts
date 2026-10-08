import { expect, test } from "@playwright/test";
import { ADMIN, alertWith, signIn, visitorIp } from "./support";

// Losing the connection mid-submit: the form stays, with what was typed and a way to try again.

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
});

test("signing in offline keeps the email; signing in again once back online works", async ({ page, context }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel(/^Password/).fill(ADMIN.password);

  await context.setOffline(true);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(alertWith(page, "We couldn't sign you in")).toContainText("Check your connection and try again.");
  await expect(page.getByLabel("Email")).toHaveValue(ADMIN.email);
  await expect(page).toHaveURL("/admin/login");

  await context.setOffline(false);
  await signIn(page, ADMIN);
  await expect(page).toHaveURL("/admin");
});
