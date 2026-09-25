import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Runs against a web server whose API can't be reached (see playwright.config.ts): every page must
// fail politely, with no internal details, and offer a way to try again.
const baseURL = process.env.E2E_API_DOWN_URL!;
test.use({ baseURL });

// Filtered by text: Next's route announcer is a role="alert" element too.
const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("when the API is down", () => {
  test("an admin page shows the error page, and Try again fetches it again", async ({ page, context }) => {
    // A session cookie gets past the signed-out redirect; checking it with the API then fails.
    await context.addCookies([{ name: "brighte_session", value: "any-token", url: baseURL }]);
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(500);
    // Every page gets a request id, which the web server's log lines for it carry.
    expect(response?.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);

    const heading = page.getByRole("heading", { level: 1, name: "Something went wrong, please try again later" });
    await expect(heading).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByText(/ECONNREFUSED|localhost:9|NETWORK_ERROR/)).toHaveCount(0);
    // The error's digest, logged with the details by src/instrumentation.ts, to quote to support.
    await expect(page.getByText(/^Reference: \S+$/)).toBeVisible();
    await expectNoA11yViolations(page);

    // Try again asks the server for the page again; the API is still down, so the error stays.
    const refetch = page.waitForRequest((request) => request.url().includes("/admin"));
    await page.getByRole("button", { name: "Try again" }).click();
    await refetch;
    await expect(heading).toBeVisible();
  });

  test("the register page explains it can't show the form, with a link to try again", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Register your interest in Brighte Eats");
    await expect(alertWith(page, "We can't show the form right now")).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("button", { name: "Register interest" })).toHaveCount(0);
    await expectNoA11yViolations(page);
  });

  test("signing in says it couldn't, without details", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("admin@brighte.dev");
    await page.getByLabel(/^Password/).fill("admin-dev-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(alertWith(page, "We couldn't sign you in")).toContainText("Please try again in a moment.");
    await expect(page).toHaveURL("/admin/login");
  });
});
