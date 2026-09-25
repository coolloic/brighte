import { describe, expect, it } from "vitest";
import { dashboardHref, nextSort, parseDashboardParams, sortState } from "./dashboard";

const defaults = { q: undefined, service: undefined, sort: "newest", size: 20, page: 1, lead: undefined };

describe("dashboard URL", () => {
  it.each([
    [{}, defaults],
    [
      { q: " ada ", service: "delivery", sort: "name_desc", size: "50", page: "3", lead: "abc" },
      { q: "ada", service: "delivery", sort: "name_desc", size: 50, page: 3, lead: "abc" },
    ],
    [{ page: "0" }, defaults],
    [{ page: "2.5" }, defaults],
    [{ page: "two" }, defaults],
    [{ sort: "shoe_size" }, defaults],
    [{ size: "25" }, defaults],
    [{ size: "1000" }, defaults],
    [{ q: "   " }, defaults],
    [{ service: ["pick-up", "payment"], lead: "  " }, { ...defaults, service: "pick-up" }],
  ])("parses %j", (searchParams, expected) => {
    expect(parseDashboardParams(searchParams)).toEqual(expected);
  });

  it("cuts a search to the API's 100 characters", () => {
    expect(parseDashboardParams({ q: "x".repeat(150) }).q).toHaveLength(100);
  });

  it.each([
    [{}, "/admin"],
    [{ page: 1, sort: "newest", size: 20 }, "/admin"],
    [{ service: "pick-up", page: 2 }, "/admin?service=pick-up&page=2"],
    [{ q: "ada lovelace", sort: "email_asc", size: 50 }, "/admin?q=ada+lovelace&sort=email_asc&size=50"],
    [{ service: "delivery", page: 3, lead: "019a" }, "/admin?service=delivery&page=3&lead=019a"],
    [{ q: "a&b" }, "/admin?q=a%26b"],
  ] as const)("builds %j", (params, href) => {
    expect(dashboardHref(params)).toBe(href);
  });

  it("round-trips", () => {
    const params = { q: "bea", service: "payment", sort: "postcode_desc", size: 100, page: 4, lead: "019a2b3c" } as const;
    expect(parseDashboardParams(Object.fromEntries(new URL(dashboardHref(params), "http://x").searchParams))).toEqual(params);
  });
});

describe("column sorting", () => {
  it("knows which column and direction a sort is", () => {
    expect(sortState("newest")).toEqual({ column: "registered", direction: "descending" });
    expect(sortState("name_asc")).toEqual({ column: "name", direction: "ascending" });
  });

  it("a new column starts ascending, except Registered, which starts newest first", () => {
    expect(nextSort("newest", "name")).toBe("name_asc");
    expect(nextSort("name_asc", "registered")).toBe("newest");
  });

  it("the current column flips direction", () => {
    expect(nextSort("name_asc", "name")).toBe("name_desc");
    expect(nextSort("name_desc", "name")).toBe("name_asc");
    expect(nextSort("newest", "registered")).toBe("oldest");
  });
});
