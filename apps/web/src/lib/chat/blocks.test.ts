import { describe, expect, it } from "vitest";
import { blockContents, hasBlock } from "./blocks";

describe("hasBlock", () => {
  it("finds a fence line in the language", () => {
    expect(hasBlock("Here's your profile.\n\n```profile\n{}\n```", "profile")).toBe(true);
  });

  it("finds a fence that is still open (streaming)", () => {
    expect(hasBlock("Here's your profile.\n\n```profile\n{", "profile")).toBe(true);
  });

  it.each([
    ["another language", "```profile-x\n{}\n```"],
    ["the word in prose", "I'll build your profile next."],
    ["a fence that isn't on its own line", "Use ```profile blocks."],
    ["no fence", "Hello"],
  ])("ignores %s", (_, text) => {
    expect(hasBlock(text, "profile")).toBe(false);
  });
});

describe("blockContents", () => {
  it("returns each block's contents, closed or still open", () => {
    const text = "Intro\n\n```profile\n{\"a\":1}\n```\n\nMiddle\n\n```profile\n{\"b\":";
    expect(blockContents(text, "profile")).toEqual(['{"a":1}', '{"b":']);
  });

  it("ignores other languages", () => {
    expect(blockContents("```match\n{}\n```", "profile")).toEqual([]);
  });
});
