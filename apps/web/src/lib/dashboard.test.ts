import { describe, expect, it } from "vitest";
import { dashboardHref, parseDashboardParams } from "./dashboard";

describe("dashboard URL", () => {
  it.each([
    [{}, { service: undefined, page: 1, lead: undefined }],
    [{ service: "delivery", page: "3", lead: "abc" }, { service: "delivery", page: 3, lead: "abc" }],
    [{ page: "0" }, { service: undefined, page: 1, lead: undefined }],
    [{ page: "-2" }, { service: undefined, page: 1, lead: undefined }],
    [{ page: "2.5" }, { service: undefined, page: 1, lead: undefined }],
    [{ page: "two" }, { service: undefined, page: 1, lead: undefined }],
    [{ service: ["pick-up", "payment"], lead: "  " }, { service: "pick-up", page: 1, lead: undefined }],
  ])("parses %j", (searchParams, expected) => {
    expect(parseDashboardParams(searchParams)).toEqual(expected);
  });

  it.each([
    [{}, "/admin"],
    [{ page: 1 }, "/admin"],
    [{ service: "pick-up", page: 2 }, "/admin?service=pick-up&page=2"],
    [{ service: "delivery", page: 3, lead: "019a" }, "/admin?service=delivery&page=3&lead=019a"],
    [{ service: "a b&c" }, "/admin?service=a+b%26c"],
  ])("builds %j", (params, href) => {
    expect(dashboardHref(params)).toBe(href);
  });

  it("round-trips", () => {
    const params = { service: "payment", page: 4, lead: "019a2b3c" };
    const href = dashboardHref(params);
    expect(parseDashboardParams(Object.fromEntries(new URL(href, "http://x").searchParams))).toEqual(params);
  });
});
