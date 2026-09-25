import { describe, expect, it } from "vitest";
import { requestIdFrom } from "./request-id";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const idFor = (value?: string) => requestIdFrom(new Headers(value === undefined ? {} : { "x-request-id": value }));

describe("requestIdFrom", () => {
  it("keeps an id from in front of this server", () => {
    expect(idFor("lb-trace-0b6f3c2e")).toBe("lb-trace-0b6f3c2e");
  });

  it("creates one when there is none", () => {
    expect(idFor()).toMatch(UUID);
  });

  it("replaces one that could forge log text, or is too short or long to be an id", () => {
    for (const bad of ["abc", "x".repeat(129), 'id-1234"level":60', "has spaces here"]) expect(idFor(bad)).toMatch(UUID);
  });
});
