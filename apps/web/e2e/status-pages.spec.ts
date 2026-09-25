import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoA11yViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("status pages", () => {
  test("an unknown URL is a 404 with a way back home", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle("Page not found | Brighte Eats");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sorry, we can't find that page");
    await expect(page.getByRole("banner")).toBeVisible();
    await expectNoA11yViolations(page);

    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Register your interest in Brighte Eats");
  });

  test("a submit that can't reach the server shows the error page, not the framework's", async ({ page, context }) => {
    await page.goto("/");
    await page.getByLabel("Full name").fill("Ada Lovelace");
    await page.getByLabel("Email").fill("offline@example.com");
    await page.getByLabel("Mobile number").fill("0412 345 678");
    await page.getByLabel("Postcode").fill("2000");
    await page.getByRole("checkbox", { name: "Delivery" }).check();

    await context.setOffline(true);
    await page.getByRole("button", { name: "Register interest" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Something went wrong, please try again later");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
