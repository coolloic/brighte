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

/**
 * Submits and waits for the server's answer. The confirmation shows before it arrives (optimistic),
 * so seeing it doesn't mean the registration is saved yet.
 */
const submitAndWait = (page: Page) =>
  Promise.all([page.waitForResponse((response) => response.request().method() === "POST"), submit(page)]);

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
    // Canonical and sharing URLs are absolute, on SITE_URL (the e2e server's own address).
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new URL("/", page.url()).origin);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", new URL("/", page.url()).origin);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    // Structured data parses, and describes this page.
    const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!) as Record<string, unknown>;
    expect(jsonLd).toMatchObject({ "@type": "WebPage", name: "Register your interest in Brighte Eats", url: new URL("/", page.url()).href });
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

  test("the logo goes home: after registering, it brings back an empty form", async ({ page }) => {
    await page.goto("/");
    await fillValid(page);
    await submit(page);
    await expect(page.getByRole("heading", { name: "Thanks, you're registered" })).toBeVisible();

    await page.getByRole("link", { name: "Brighte Eats" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByLabel("Full name")).toHaveValue("");
    await expect(page.getByRole("heading", { name: "Thanks, you're registered" })).toHaveCount(0);
  });

  test("a reload keeps what was typed, until the registration is confirmed", async ({ page }) => {
    await page.goto("/");
    const email = await fillValid(page);
    await page.reload();
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace");
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByLabel("Mobile number")).toHaveValue("0412 345 678");
    await expect(page.getByLabel("Postcode")).toHaveValue("2000");
    await expect(page.getByRole("checkbox", { name: "Delivery" })).toBeChecked();
    await expectNoA11yViolations(page);

    // The restored values are what gets sent; once registered, a reload starts empty.
    await submitAndWait(page);
    await expect(page.getByRole("heading", { name: "Thanks, you're registered" })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Full name")).toHaveValue("");
    await expect(page.getByRole("checkbox", { name: "Delivery" })).not.toBeChecked();
  });

  test("the draft stays in its tab", async ({ page, context }) => {
    await page.goto("/");
    await page.getByLabel("Full name").fill("Ada Lovelace");
    const other = await context.newPage();
    await other.goto("/");
    await expect(other.getByRole("button", { name: "Register interest" })).toBeVisible();
    await expect(other.getByLabel("Full name")).toHaveValue("");
  });

  test("the skip link is the first Tab stop, shows when focused and moves focus to the main content", async ({ page }) => {
    await page.goto("/");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).not.toBeInViewport();
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  });

  test("checks the form in the browser, without sending anything, and focuses the first problem", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
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
    // Caught in the browser: nothing reached the server, so nothing counted against the rate limit.
    expect(posts).toEqual([]);

    // Fixing one field and submitting again updates the messages.
    await page.getByLabel("Full name").fill("Ada Lovelace");
    await submit(page);
    await expect(page.getByLabel("Email")).toBeFocused();
    await expect(page.getByLabel("Full name")).toHaveAccessibleDescription("");
    expect(posts).toEqual([]);
  });

  test("flags an email that has already registered, keeping what was typed", async ({ page }) => {
    const email = uniqueEmail();
    await page.goto("/");
    await fillValid(page, email);
    await submitAndWait(page);
    await expect(page.getByRole("heading", { name: "Thanks, you're registered" })).toBeVisible();

    await page.goto("/");
    await fillValid(page, email);
    await submit(page);
    await expect(page.getByLabel("Email")).toBeFocused();
    await expect(page.getByLabel("Email")).toHaveAccessibleDescription("This email has already registered interest. Use a different email.");
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace");
  });

  test("asks the visitor to wait after too many attempts", async ({ page }) => {
    // The API allows 5 registrations a minute per visitor. Only values that pass the browser's check
    // reach it, so use a valid email that is already registered: 1 success, then 4 duplicates...
    const email = uniqueEmail();
    await page.goto("/");
    await fillValid(page, email);
    await submitAndWait(page);
    await expect(page.getByRole("heading", { name: "Thanks, you're registered" })).toBeVisible();

    await page.goto("/");
    await fillValid(page, email);
    for (let attempt = 2; attempt <= 5; attempt++) {
      await submitAndWait(page);
      await expect(page.getByLabel("Email")).toHaveAccessibleDescription("This email has already registered interest. Use a different email.");
    }
    // ...and the 6th attempt is over the limit.
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

test("robots.txt allows crawling and points to a sitemap that lists only the public page", async ({ request, baseURL }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Allow: /");
  // /admin isn't disallowed: crawlers must be able to see its noindex.
  expect(robots).not.toContain("Disallow");
  expect(robots).toContain(`Sitemap: ${baseURL}/sitemap.xml`);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`<loc>${baseURL}/</loc>`);
  expect(sitemap).not.toContain("/admin");
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
