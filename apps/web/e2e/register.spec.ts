import { randomInt, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Every test is a different visitor (see playwright.config.ts), so rate limits don't carry over.
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.${randomInt(256)}.${randomInt(1, 255)}` });
});

const uniqueEmail = () => `e2e-${randomUUID()}@example.com`;

async function fillValid(page: Page, email = uniqueEmail()) {
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mobile number").fill("0412 345 678");
  await page.getByLabel("Postcode").fill("2000");
  await page.getByRole("checkbox", { name: "Delivery" }).check();
  return email;
}

const submit = (page: Page) => page.getByRole("button", { name: "Register interest" }).click();

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("register page", () => {
  test("has one h1, landmarks, SEO metadata and the Brighte favicon", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Register your interest | Brighte Eats");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Brighte Eats/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Register your interest in Brighte Eats");
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /icon\.png/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Register your interest in Brighte Eats");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    // Service options come from the API.
    for (const service of ["Delivery", "Pick-up", "Payment"]) {
      await expect(page.getByRole("checkbox", { name: service })).toBeVisible();
    }
    await expectNoA11yViolations(page);
  });

  test("registers interest and moves focus to the confirmation", async ({ page }) => {
    await page.goto("/");
    await fillValid(page);
    await submit(page);
    await expect(page.getByRole("heading", { name: "Thanks, you're registered" })).toBeFocused();
    await expectNoA11yViolations(page);
  });

  test("shows the API's field errors next to each field and focuses the first", async ({ page }) => {
    await page.goto("/");
    await submit(page);
    await expect(page.getByLabel("Full name")).toBeFocused();
    await expect(page.getByLabel("Full name")).toHaveAccessibleDescription("Name is required");
    await expect(page.getByLabel("Email")).toHaveAccessibleDescription("Enter a valid email address");
    // Error, then hint: the error doesn't repeat the hint's example.
    await expect(page.getByLabel("Mobile number")).toHaveAccessibleDescription("Enter an Australian mobile number e.g. 0412 345 678");
    await expect(page.getByLabel("Postcode")).toHaveAccessibleDescription("Enter a 4-digit postcode 4 digits, e.g. 2000");
    await expect(page.getByText("Choose at least one service")).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("flags an email that has already registered, keeping what was typed", async ({ page }) => {
    const email = uniqueEmail();
    await page.goto("/");
    await fillValid(page, email);
    await submit(page);
    await expect(page.getByRole("heading", { name: "Thanks, you're registered" })).toBeVisible();

    await page.goto("/");
    await fillValid(page, email);
    await submit(page);
    await expect(page.getByLabel("Email")).toBeFocused();
    await expect(page.getByLabel("Email")).toHaveAccessibleDescription("This email has already registered interest. Use a different email.");
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace");
  });

  test("asks the visitor to wait after too many attempts", async ({ page }) => {
    await page.goto("/");
    // The API allows 5 registrations a minute per visitor; each submit here is one attempt.
    for (let attempt = 1; attempt <= 5; attempt++) {
      await submit(page);
      await expect(page.getByLabel("Full name")).toHaveAccessibleDescription("Name is required");
      await expect(page.getByRole("button", { name: "Register interest" })).toBeEnabled();
    }
    await submit(page);
    const status = page.getByRole("status").filter({ hasText: "Too many attempts" });
    // Screen readers get the wait once (the first block is 1 minute)...
    await expect(status).toContainText("Please wait 1 minute and try again.");
    // ...while the visible text counts down in the browser.
    const countdown = status.locator("[data-countdown]");
    await expect(countdown).toHaveText(/Please wait (1 minute|\d+ seconds) and try again\./);
    const first = await countdown.textContent();
    await expect(countdown).not.toHaveText(first!, { timeout: 3000 });
    await expect(countdown).toHaveText(/Please wait 5\d seconds and try again\./);
  });
});

test.describe("register page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the browser's own form submit shows errors, keeps values, then registers", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Full name").fill("Ada Lovelace");
    await submit(page);
    await expect(page.getByLabel("Email")).toHaveAccessibleDescription("Enter a valid email address");
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace");

    await fillValid(page);
    await submit(page);
    await expect(page.getByRole("heading", { name: "Thanks, you're registered" })).toBeVisible();
  });
});
