import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { registerLead, signInAsAdmin, visitorIp } from "./support";

// Needs the seed admin (pnpm db:seed). Leads are created per test, straight through the API.

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
});

test.describe("leads dashboard", () => {
  test("lists leads newest first, with the filter and count; passes axe", async ({ page }) => {
    const lead = await registerLead();
    await signInAsAdmin(page);
    await expect(page).toHaveTitle("Leads | Brighte Eats");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Leads");
    await expect(page.getByRole("link", { name: "All services" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(/^\d+ leads?$/)).toBeVisible();
    await expect(page.getByRole("link", { name: lead.name })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  });

  test("filters by service, and back to all services", async ({ page }) => {
    const lead = await registerLead({ services: ["payment"] });
    await signInAsAdmin(page);
    await page.getByRole("link", { name: "Payment" }).click();
    await expect(page).toHaveURL("/admin?service=payment");
    await expect(page.getByRole("link", { name: "Payment" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: lead.name })).toBeVisible();
    await page.getByRole("link", { name: "All services" }).click();
    await expect(page).toHaveURL("/admin");
  });

  test("opens a lead's details, with email and phone links", async ({ page, isMobile }) => {
    const lead = await registerLead({ services: ["pick-up", "payment"] });
    await signInAsAdmin(page, "/admin?service=pick-up");
    await page.getByRole("link", { name: lead.name }).click();
    await expect(page).toHaveURL(`/admin?service=pick-up&lead=${lead.id}`);

    const detail = page.getByRole("complementary", { name: "Selected lead" });
    await expect(detail.getByRole("heading", { name: lead.name })).toBeVisible();
    await expect(detail.getByRole("link", { name: lead.email })).toHaveAttribute("href", `mailto:${lead.email}`);
    await expect(detail.getByRole("link", { name: "0412 345 678" })).toHaveAttribute("href", "tel:0412345678");

    if (isMobile) {
      // On a phone the detail replaces the list, with a way back.
      await expect(page.getByRole("link", { name: lead.name })).toBeHidden();
      await page.getByRole("link", { name: "Back to all leads" }).click();
      await expect(page).toHaveURL("/admin?service=pick-up");
      await expect(page.getByRole("link", { name: lead.name })).toBeVisible();
    } else {
      // Side by side: the selected lead is marked in the list.
      await expect(page.getByRole("link", { name: lead.name })).toHaveAttribute("aria-current", "page");
    }
  });

  test("pages through leads, and a page past the end goes to the last one", async ({ page }) => {
    await signInAsAdmin(page);
    const total = Number((await page.getByText(/^\d+ leads?$/).textContent())!.split(" ")[0]);
    // Make sure there are at least two pages.
    for (let i = total; i <= 20; i++) await registerLead();
    await page.reload();

    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL("/admin?page=2");
    await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText(/Showing 21–\d+ of \d+ leads/);
    await page.getByRole("link", { name: "Prev" }).click();
    await expect(page).toHaveURL("/admin");

    await page.goto("/admin?page=9999");
    await expect(page).toHaveURL(/\/admin\?page=\d+$/);
    await expect(page.getByRole("navigation", { name: "Pagination" }).getByText("Next")).toHaveAttribute("aria-disabled", "true");
  });

  test("an unknown or malformed lead id shows 'Lead not found'", async ({ page }) => {
    await signInAsAdmin(page, "/admin?lead=not-a-lead-id");
    await expect(page.getByRole("complementary", { name: "Selected lead" })).toContainText("Lead not found");
    await page.goto("/admin?lead=01a0d70a-0000-7000-8000-000000000000");
    await expect(page.getByRole("complementary", { name: "Selected lead" })).toContainText("Lead not found");
  });

  test("a link to a lead survives signing in", async ({ page }) => {
    const lead = await registerLead();
    const link = `/admin?service=pick-up&lead=${lead.id}`;
    await page.goto(link);
    await expect(page).toHaveURL(`/admin/login?next=${encodeURIComponent(link)}`);
    await signInAsAdmin(page, link);
    await expect(page.getByRole("complementary", { name: "Selected lead" }).getByRole("heading", { name: lead.name })).toBeVisible();
  });
});

test.describe("leads dashboard without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("filters and opens a lead with plain links", async ({ page }) => {
    const lead = await registerLead({ services: ["pick-up"] });
    await signInAsAdmin(page);
    await page.getByRole("link", { name: "Pick-up" }).click();
    await expect(page).toHaveURL("/admin?service=pick-up");
    await page.getByRole("link", { name: lead.name }).click();
    await expect(page.getByRole("complementary", { name: "Selected lead" })).toContainText(lead.email);
  });
});
