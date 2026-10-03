import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_PATTERNS, isAllowedModel, parseModelPatterns } from "./model-patterns";

describe("model patterns", () => {
  const defaults = parseModelPatterns(DEFAULT_MODEL_PATTERNS);

  it.each([
    ["anthropic", "claude-haiku-4-5"],
    ["anthropic", "claude-haiku-4-5-20251001"],
    ["openai", "gpt-5-mini"],
    ["openai", "gpt-4.1-nano"],
    ["gemini", "gemini-2.5-flash"],
    ["gemini", "gemini-2.5-flash-lite"],
  ])("allows the cheap tier by default: %s %s", (provider, model) => {
    expect(isAllowedModel(defaults, provider, model)).toBe(true);
  });

  it.each([
    ["anthropic", "claude-opus-5"],
    ["anthropic", "claude-3-haiku-20240307"],
    ["openai", "gpt-5"],
    ["openai", "gpt-4o-mini-tts"],
    ["openai", "gpt-5-mini-2025-08-07"],
    ["gemini", "gemini-2.5-pro"],
    ["gemini", "gemini-2.5-flash-preview-tts"],
    // A pattern belongs to its provider only.
    ["openai", "claude-haiku-4-5"],
  ])("rejects other models by default: %s %s", (provider, model) => {
    expect(isAllowedModel(defaults, provider, model)).toBe(false);
  });

  it("supports exclusions and wildcard providers", () => {
    const patterns = parseModelPatterns(" *:*, !openai:*-tts* ");
    expect(isAllowedModel(patterns, "gemini", "gemini-2.5-pro")).toBe(true);
    expect(isAllowedModel(patterns, "openai", "gpt-4o-mini-tts")).toBe(false);
  });

  it("treats regex characters as literal", () => {
    const patterns = parseModelPatterns("openai:gpt-4.1");
    expect(isAllowedModel(patterns, "openai", "gpt-4.1")).toBe(true);
    expect(isAllowedModel(patterns, "openai", "gpt-401")).toBe(false);
  });

  it("allows nothing for an empty or malformed spec", () => {
    expect(isAllowedModel(parseModelPatterns(""), "anthropic", "claude-haiku-4-5")).toBe(false);
    expect(isAllowedModel(parseModelPatterns("claude-haiku-*"), "anthropic", "claude-haiku-4-5")).toBe(false);
  });
});
