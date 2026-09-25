import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, alertWith, signIn, USER, visitorIp } from "./support";

// Needs the seed accounts: pnpm db:seed.

// Every test is a different visitor, so the login rate limit doesn't carry over.
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
});

/** Sign out from the account menu (the avatar in the header). */
async function signOut(page: Page) {
  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
}

test.describe("admin sign-in", () => {
  test("/admin sends a signed-out visitor to sign in; the page isn't indexed", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL("/admin/login?next=%2Fadmin");
    await expect(page).toHaveTitle("Admin sign in | Brighte Eats");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin sign in");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  });

  test("checks the form in the browser without sending anything", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (request) => {
      // Browser reports (Web Vitals) aren't the form: they never reach the API.
      if (request.method() === "POST" && !request.url().endsWith("/api/browser-reports")) posts.push(request.url());
    });
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByLabel("Email")).toBeFocused();
    await expect(page.getByLabel("Email")).toHaveAccessibleDescription("Enter a valid email address");
    await expect(page.getByLabel(/^Password/)).toHaveAccessibleDescription("Enter your password");
    expect(posts).toEqual([]);
  });

  test("a wrong password: one message for any mistake, email kept, password cleared and focused", async ({ page }) => {
    await page.goto("/admin/login");
    await signIn(page, { email: ADMIN.email, password: "not-the-password" });
    await expect(alertWith(page, "Email or password is incorrect")).toContainText("Check them and try again.");
    await expect(page.getByLabel("Email")).toHaveValue(ADMIN.email);
    await expect(page.getByLabel(/^Password/)).toHaveValue("");
    await expect(page.getByLabel(/^Password/)).toBeFocused();
  });

  test("an account that isn't an admin can't get in", async ({ page, context }) => {
    await page.goto("/admin/login");
    await signIn(page, USER);
    await expect(alertWith(page, "This account can't view leads")).toContainText("Sign in with an admin account.");
    expect(await context.cookies()).toEqual([]);
  });

  test("an admin signs in with an httpOnly session cookie, and signs out", async ({ page, context }) => {
    await page.goto("/admin");
    await signIn(page, ADMIN);
    await expect(page).toHaveURL("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Leads");
    // The account menu shows who is signed in; the keyboard opens and closes it too.
    await page.locator("header summary").click();
    await expect(page.locator("header").getByText(ADMIN.email)).toBeVisible();
    await page.locator("header summary").press("Enter");
    await expect(page.locator("header").getByText(ADMIN.email)).toBeHidden();
    await page.locator("header summary").press("Enter");
    await expect(page.locator("header").getByText(ADMIN.email)).toBeVisible();
    // Escape and a click outside close it.
    await page.keyboard.press("Escape");
    await expect(page.locator("header").getByText(ADMIN.email)).toBeHidden();
    await expect(page.locator("header summary")).toBeFocused();
    await page.locator("header summary").click();
    await page.getByRole("contentinfo").click();
    await expect(page.locator("header").getByText(ADMIN.email)).toBeHidden();

    const [session] = await context.cookies();
    expect(session).toMatchObject({ name: "brighte_session", httpOnly: true, sameSite: "Lax", path: "/" });
    expect(session.expires).toBeGreaterThan(Date.now() / 1000);
    expect(await page.evaluate(() => document.cookie)).toBe("");

    // Signed in: the sign-in page goes straight on.
    await page.goto("/admin/login");
    await expect(page).toHaveURL("/admin");

    await signOut(page);
    await expect(page).toHaveURL("/admin/login");
    expect(await context.cookies()).toEqual([]);
    await page.goto("/admin");
    await expect(page).toHaveURL("/admin/login?next=%2Fadmin");
  });

  test("never follows ?next= to another site", async ({ page }) => {
    await page.goto("/admin/login?next=https://evil.example/");
    await signIn(page, ADMIN);
    await expect(page).toHaveURL("/admin");
  });

  test("a forged session cookie doesn't get in", async ({ page, context }) => {
    await context.addCookies([{ name: "brighte_session", value: "not.a.token", url: page.url() === "about:blank" ? "http://localhost" : page.url() }]);
    await page.goto("/admin");
    await expect(page).toHaveURL("/admin/login?next=%2Fadmin");
  });
});

test.describe("admin sign-in without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("signs in and out with the browser's own form posts", async ({ page }) => {
    await page.goto("/admin/login");
    await signIn(page, { email: ADMIN.email, password: "not-the-password" });
    await expect(alertWith(page, "Email or password is incorrect")).toContainText("Check them and try again.");
    await expect(page.getByLabel(/^Password/)).toHaveValue("");

    await signIn(page, ADMIN);
    await expect(page).toHaveURL("/admin");
    await signOut(page);
    await expect(page).toHaveURL("/admin/login");
  });
});
