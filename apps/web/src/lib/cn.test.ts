import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cn, CUSTOM_RADIUS, CUSTOM_SHADOW } from "./cn";

describe("cn", () => {
  it("joins conditional class names", () => {
    expect(cn("a", false && "b", ["c", { d: true, e: false }])).toBe("a c d");
  });

  it.each([
    ["size and color are different properties: both stay", ["text-xl", "text-fg-brand"], "text-xl text-fg-brand"],
    ["a later color overrides", ["text-fg-brand", "text-on-action"], "text-on-action"],
    ["border width and color both stay", ["border-2", "border-action"], "border-2 border-action"],
    ["a caller's width overrides", ["w-full", "w-auto"], "w-auto"],
    ["custom radius overrides custom radius", ["rounded-control", "rounded-card"], "rounded-card"],
    ["built-in radius overrides custom radius", ["rounded-control", "rounded-full"], "rounded-full"],
    ["custom shadow can be removed", ["shadow-card", "shadow-none"], "shadow-none"],
    ["state variants are kept apart", ["bg-action", "hover:bg-action-hover", "bg-surface"], "hover:bg-action-hover bg-surface"],
  ])("%s", (_, inputs, expected) => {
    expect(cn(...inputs)).toBe(expected);
  });

  it("knows every radius and shadow token defined in globals.scss", () => {
    const css = readFileSync(path.join(import.meta.dirname, "../app/globals.scss"), "utf8");
    const names = (prefix: string) => [...css.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+):`, "g"))].map((m) => m[1]);
    expect(names("radius").sort()).toEqual([...CUSTOM_RADIUS].sort());
    expect(names("shadow").sort()).toEqual([...CUSTOM_SHADOW].sort());
  });
});
