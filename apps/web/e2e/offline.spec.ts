import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ADMIN, alertWith, signIn, visitorIp } from "./support";

// Losing the connection mid-submit: the form stays, with what was typed and a way to try again.

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
});

test("registering offline keeps the form and its values; Try again sends it once back online", async ({ page, context }) => {
  const email = `e2e-${randomUUID()}@example.com`;
  await page.goto("/");
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mobile number").fill("0412 345 678");
  await page.getByLabel("Postcode").fill("2000");
  await page.getByRole("checkbox", { name: "Delivery" }).check();

  await context.setOffline(true);
  await page.getByRole("button", { name: "Register interest" }).click();
  const alert = alertWith(page, "We couldn't send your registration");
  await expect(alert).toContainText("Your details are still here.");
  // The confirmation shown meanwhile (optimistic) is withdrawn, and focus goes to the alert, not the page.
  await expect(page.getByRole("heading", { name: "Thanks, you're registered" })).toHaveCount(0);
  await expect(alert.locator("..")).toBeFocused();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Register your interest in Brighte Eats");
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page.getByRole("checkbox", { name: "Delivery" })).toBeChecked();

  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Thanks, you're registered" })).toBeFocused();
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
