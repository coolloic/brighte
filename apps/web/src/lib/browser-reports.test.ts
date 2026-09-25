import { describe, expect, it } from "vitest";
import { parseBrowserReport } from "./browser-reports";

const vital = { type: "vital", name: "LCP", value: 1234.5, rating: "good", id: "v5-1", navigationType: "navigate", page: "/" };
const error = { type: "error", kind: "error", name: "TypeError", message: "x is undefined", stack: "TypeError: x is undefined\n    at f (a.js:1:2)", page: "/admin" };

describe("parseBrowserReport", () => {
  it("accepts a Web Vital and an error, with the page's request id", () => {
    expect(parseBrowserReport({ ...vital, requestId: "req-12345678" })).toEqual({ ...vital, requestId: "req-12345678" });
    expect(parseBrowserReport({ ...error, source: "http://x.test/_next/a.js", line: 1, column: 2 })).toMatchObject({ ...error, source: "http://x.test/_next/a.js", line: 1, column: 2 });
  });

  it("keeps only known fields, and drops a request id that isn't one", () => {
    const report = parseBrowserReport({ ...vital, requestId: "not an id!", extra: "anything", email: "a@b.dev" });
    expect(report).toEqual(vital);
  });

  it("drops the query from URLs: the dashboard's ?q= holds searched names", () => {
    expect(parseBrowserReport({ ...error, page: "/admin?q=ada#x", source: "http://x.test/a.js?v=1" })).toMatchObject({ page: "/admin", source: "http://x.test/a.js" });
  });

  it("cuts long strings", () => {
    const report = parseBrowserReport({ ...error, message: "m".repeat(5000), stack: "s".repeat(10_000) });
    expect(report).toMatchObject({ message: "m".repeat(1000), stack: "s".repeat(4000) });
  });

  it("refuses anything else", () => {
    for (const bad of [
      null,
      "text",
      { ...vital, type: "other" },
      { ...vital, page: "https://evil.test/" },
      { ...vital, name: "FAKE" },
      { ...vital, value: -1 },
      { ...vital, value: "fast" },
      { ...vital, rating: "great" },
      { ...error, kind: "other" },
      { ...error, message: "" },
    ]) {
      expect(parseBrowserReport(bad)).toBeNull();
    }
  });
});
