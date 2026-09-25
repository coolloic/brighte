import { describe, expect, it } from "vitest";
import { formatMobile, formatRegistered } from "./leads";

describe("formatRegistered", () => {
  it("formats in Sydney time, whatever the machine's timezone", () => {
    // 23:15 UTC on the 24th is 9:15 am on the 25th in Sydney (AEST, UTC+10).
    expect(formatRegistered("2026-09-24T23:15:00Z")).toBe("25 Sept 2026, 9:15 am");
  });
});

describe("formatMobile", () => {
  it("groups a stored mobile as 0412 345 678", () => {
    expect(formatMobile("0412345678")).toBe("0412 345 678");
  });

  it("leaves anything unexpected unchanged", () => {
    expect(formatMobile("+61 412")).toBe("+61 412");
  });
});
