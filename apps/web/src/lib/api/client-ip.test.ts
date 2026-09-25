import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

describe("clientIp", () => {
  it.each([
    ["no trusted proxy: nothing is trusted", "203.0.113.7", 0, undefined],
    ["no header", null, 1, undefined],
    ["one proxy: its entry is the visitor", "203.0.113.7", 1, "203.0.113.7"],
    ["one proxy: a spoofed entry on the left is ignored", "6.6.6.6, 203.0.113.7", 1, "203.0.113.7"],
    ["two proxies: the visitor is second from the right", "6.6.6.6, 203.0.113.7, 10.0.0.2", 2, "203.0.113.7"],
    ["spaces and empty entries are ignored", " 203.0.113.7 ,, ", 1, "203.0.113.7"],
    ["more hops than entries", "203.0.113.7", 2, undefined],
    ["a non-integer setting trusts nothing", "203.0.113.7", Number.NaN, undefined],
  ])("%s", (_, header, hops, expected) => {
    expect(clientIp(header, hops)).toBe(expected);
  });
});
