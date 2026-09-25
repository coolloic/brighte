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
      // Side by side: the selected lead is marked in the list, and Close gives the list its full width back.
      await expect(page.getByRole("link", { name: lead.name })).toHaveAttribute("aria-current", "page");
      const listWidth = () => page.locator("table").evaluate((table) => table.getBoundingClientRect().width);
      const narrowed = await listWidth();
      await detail.getByRole("link", { name: "Close lead details" }).click();
      await expect(page).toHaveURL("/admin?service=pick-up");
      await expect(detail).toBeHidden();
      await expect(page.getByRole("link", { name: lead.name })).not.toHaveAttribute("aria-current");
      expect(await listWidth()).toBeGreaterThan(narrowed);
    }
  });

  test("selecting a lead keeps the list where it was, with the detail in view", async ({ page, isMobile }) => {
    await signInAsAdmin(page, "/admin?size=50");
    // Cards on phones (the list's own items, not each card's service badges), rows from md.
    const rows = isMobile ? page.locator('ul[aria-label="All leads"] > li') : page.locator("table tbody tr");
    await expect(rows).toHaveCount(50);
    const lead = rows.nth(40).getByRole("link").first();
    await lead.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

    await lead.click();
    await expect(page).toHaveURL(/lead=/);
    const detail = page.getByRole("complementary", { name: "Selected lead" });
    await expect(detail).toBeInViewport();
    if (!isMobile) {
      // Desktop: no jump to the top. The detail column narrows the list, so rows can reflow, but
      // the browser keeps the selected row in view, with the sticky detail beside it.
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
      await expect(lead).toBeInViewport();
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

test.describe("search, sort and page size", () => {
  test("searches after a pause in typing, keeping focus; Back returns to the full list", async ({ page }) => {
    const token = `Srch${Date.now().toString(36)}`;
    const lead = await registerLead({ name: `Ada ${token}` });
    await registerLead({ name: `Bea ${token}` });
    await signInAsAdmin(page);

    const box = page.getByRole("searchbox", { name: "Search leads" });
    await box.pressSequentially(`ada ${token}`, { delay: 30 });
    // Debounced: one search for the whole phrase, not one per keystroke.
    await expect(page).toHaveURL(`/admin?q=ada+${token}`);
    await expect(box).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: /^1 lead$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: lead.name })).toBeVisible();

    // Refining replaces the history entry; Back goes to the list before the search.
    await box.fill(token);
    await expect(page).toHaveURL(`/admin?q=${token}`);
    await expect(page.getByText(/^2 leads$/)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("/admin");
    await expect(box).toHaveValue("");
  });

  test("typing on while a search is loading keeps every letter", async ({ page }) => {
    const token = `Keep${Date.now().toString(36)}`;
    await registerLead({ name: `Ada ${token}` });
    await signInAsAdmin(page);
    const box = page.getByRole("searchbox", { name: "Search leads" });

    // Slow searches down, so the first one is still loading while typing goes on.
    await page.route("**/admin?q=*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    // A pause after "ad" starts its search; keep typing before it arrives.
    await box.pressSequentially("ad");
    await page.waitForTimeout(350);
    await box.pressSequentially(`a ${token}`, { delay: 60 });
    await expect(page).toHaveURL(`/admin?q=ada+${token}`);
    // Every letter is still there once both searches have landed.
    await expect(box).toHaveValue(`ada ${token}`);
    await expect(page.getByText(/^1 lead$/)).toBeVisible();
    // One history entry for the whole search, even though two searches ran.
    await page.goBack();
    await expect(page).toHaveURL("/admin");
  });

  test("Enter searches at once, without waiting for the pause", async ({ page }) => {
    await signInAsAdmin(page);
    const box = page.getByRole("searchbox", { name: "Search leads" });
    // No Search button with JavaScript: Enter submits the one-field form, and the search runs now.
    await expect(page.getByRole("button", { name: "Search" })).toHaveCount(0);
    const submits = await page.evaluateHandle(() => {
      const count = { value: 0 };
      document.querySelector("form[role=search]")!.addEventListener("submit", () => count.value++);
      return count;
    });
    await box.fill("lovelace");
    await box.press("Enter");
    expect(await submits.evaluate((count) => count.value)).toBe(1);
    await expect(page).toHaveURL("/admin?q=lovelace");
  });

  test("a search that matches nothing says so, with a way to clear it", async ({ page }) => {
    await signInAsAdmin(page, "/admin?q=zz-no-such-lead-zz");
    await expect(page.getByText("No leads match “zz-no-such-lead-zz”")).toBeVisible();
    await page.getByRole("link", { name: "Clear search" }).click();
    await expect(page).toHaveURL("/admin");
  });

  test("column headers sort, and the sorted one is marked", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones sort with the Sort by menu (next test)");
    await signInAsAdmin(page);
    const header = (name: string) => page.getByRole("columnheader", { name });
    await expect(header("Registered")).toHaveAttribute("aria-sort", "descending"); // newest first by default

    await header("Name").getByRole("link").click();
    await expect(page).toHaveURL("/admin?sort=name_asc");
    await expect(header("Name")).toHaveAttribute("aria-sort", "ascending");
    await expect(header("Registered")).not.toHaveAttribute("aria-sort");
    await header("Name").getByRole("link").click();
    await expect(page).toHaveURL("/admin?sort=name_desc");
    await header("Registered").getByRole("link").click();
    await expect(page).toHaveURL("/admin"); // back to the default, newest first
  });

  test("phones sort with the Sort by menu", async ({ page, isMobile }) => {
    test.skip(!isMobile, "from md up the column headers sort");
    await signInAsAdmin(page);
    await page.getByRole("combobox", { name: "Sort by" }).selectOption("oldest");
    await expect(page).toHaveURL("/admin?sort=oldest");
  });

  test("sorting while a search waits out its pause keeps both", async ({ page, isMobile }) => {
    await signInAsAdmin(page);
    await page.getByRole("searchbox", { name: "Search leads" }).pressSequentially("ada");
    if (isMobile) await page.getByRole("combobox", { name: "Sort by" }).selectOption("oldest");
    else await page.getByRole("columnheader", { name: "Registered" }).getByRole("link").click();
    await expect(page).toHaveURL("/admin?q=ada&sort=oldest");
    // Past the pause: the waiting search doesn't land afterwards and undo the sort.
    await page.waitForTimeout(600);
    await expect(page).toHaveURL("/admin?q=ada&sort=oldest");
  });

  test("the page size changes how many leads a page shows", async ({ page }) => {
    await signInAsAdmin(page);
    const total = Number((await page.getByText(/^\d+ leads?$/).textContent())!.split(" ")[0]);
    for (let i = total; i <= 10; i++) await registerLead();
    await page.reload();

    await page.getByRole("combobox", { name: "Per page" }).selectOption("10");
    await expect(page).toHaveURL("/admin?size=10");
    await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText(/Showing 1–10 of \d+ leads/);
  });
});

test.describe("leads dashboard without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("searches with the Search button", async ({ page }) => {
    const lead = await registerLead({ name: `NoJs ${Date.now().toString(36)}` });
    await signInAsAdmin(page);
    await page.getByRole("searchbox", { name: "Search leads" }).fill(lead.name);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("link", { name: lead.name })).toBeVisible();
    await expect(page.getByText(/^1 lead$/)).toBeVisible();
  });

  test("filters and opens a lead with plain links", async ({ page }) => {
    const lead = await registerLead({ services: ["pick-up"] });
    await signInAsAdmin(page);
    await page.getByRole("link", { name: "Pick-up" }).click();
    await expect(page).toHaveURL("/admin?service=pick-up");
    await page.getByRole("link", { name: lead.name }).click();
    await expect(page.getByRole("complementary", { name: "Selected lead" })).toContainText(lead.email);
  });
});
