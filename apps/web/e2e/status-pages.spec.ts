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
});
