import { expect, test, type Page, type Request } from "@playwright/test";
import { visitorIp } from "./support";

// Browser errors and Web Vitals reach the web server's log (src/instrumentation-client.ts,
// app/_components/WebVitals.tsx, app/api/browser-reports/route.ts).

const PATH = "/api/browser-reports";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
});

/** The next report the page sends that matches `match`. */
const nextReport = (page: Page, match: (body: Record<string, unknown>) => boolean) =>
  page.waitForRequest((request: Request) => request.url().endsWith(PATH) && match(request.postDataJSON() as Record<string, unknown>));

test("a page load reports its Web Vitals, with the page's request id", async ({ page }) => {
  const report = nextReport(page, (body) => body.type === "vital");
  const response = await page.goto("/admin/login?next=/admin");
  const request = await report;

  expect(request.postDataJSON()).toMatchObject({
    type: "vital",
    name: expect.stringMatching(/^(TTFB|FCP|LCP|CLS|INP)$/),
    page: "/admin/login",
    requestId: response!.headers()["x-request-id"],
  });
  expect((await request.response())?.status()).toBe(204);
});

test("an uncaught error in the browser is reported", async ({ page }) => {
  await page.goto("/");
  const report = nextReport(page, (body) => body.type === "error");
  await page.evaluate(() => setTimeout(() => {
    throw new Error("e2e browser error");
  }));

  const request = await report;
  expect(request.postDataJSON()).toMatchObject({ type: "error", kind: "error", name: "Error", message: "e2e browser error", page: "/" });
  expect((await request.response())?.status()).toBe(204);
});

test.describe("the endpoint", () => {
  const vital = { type: "vital", name: "LCP", value: 900, rating: "good", id: "v5-e2e", page: "/" };

  test("refuses what isn't a report, a large body, and a flood", async ({ request }) => {
    const headers = { "x-forwarded-for": visitorIp() };
    expect((await request.post(PATH, { headers, data: "not json" })).status()).toBe(400);
    expect((await request.post(PATH, { headers, data: { ...vital, name: "FAKE" } })).status()).toBe(400);
    expect((await request.post(PATH, { headers, data: { ...vital, stack: "x".repeat(10_000) } })).status()).toBe(413);
    expect((await request.get(PATH, { headers })).status()).toBe(405);

    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) statuses.push((await request.post(PATH, { headers, data: vital })).status());
    // 3 requests above counted too: 57 accepted, then refused.
    expect(statuses.indexOf(429)).toBe(57);
  });
});
