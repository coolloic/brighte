import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_PATTERNS } from "../llm";
import { chatConfig } from "./config";

describe("chatConfig", () => {
  it("has defaults", () => {
    expect(chatConfig({})).toEqual({
      rateLimit: 20,
      rateLimitWindowSeconds: 600,
      pdfRateLimit: 30,
      // Unset: the persona's own limits apply (personas.ts).
      maxMessageChars: undefined,
      maxFiles: 3,
      maxFileBytes: 5 * 1024 * 1024,
      maxRequestBytes: 10 * 1024 * 1024,
      maxOutputTokens: undefined,
      effort: "low",
      modelPatterns: DEFAULT_MODEL_PATTERNS,
      modelsCacheSeconds: 3600,
      defaultModel: "anthropic:claude-haiku-4-5",
      persona: "brighte",
    });
  });

  it("reads the env", () => {
    const config = chatConfig({
      CHAT_RATE_LIMIT: "5",
      CHAT_RATE_LIMIT_WINDOW_SECONDS: "60",
      CHAT_MAX_MESSAGE_CHARS: "280",
      CHAT_MAX_OUTPUT_TOKENS: "512",
      CHAT_MODELS: "openai:gpt-5-mini",
      CHAT_MODELS_CACHE_SECONDS: "30",
      CHAT_DEFAULT_MODEL: "openai:gpt-5-mini",
      CHAT_PERSONA: "general",
    });
    expect(config).toMatchObject({ rateLimit: 5, rateLimitWindowSeconds: 60, maxMessageChars: 280, maxOutputTokens: 512 });
    expect(config).toMatchObject({ modelPatterns: "openai:gpt-5-mini", modelsCacheSeconds: 30, defaultModel: "openai:gpt-5-mini", persona: "general" });
  });

  it("reads the PDF rate limit", () => {
    expect(chatConfig({ CHAT_PDF_RATE_LIMIT: "5" }).pdfRateLimit).toBe(5);
  });

  it("reads the effort, falling back to low", () => {
    expect(chatConfig({ CHAT_EFFORT: "high" }).effort).toBe("high");
    expect(chatConfig({ CHAT_EFFORT: "extreme" }).effort).toBe("low");
  });

  it.each(["0", "-1", "1.5", "abc", ""])("falls back on an invalid number: %j", (value) => {
    expect(chatConfig({ CHAT_RATE_LIMIT: value }).rateLimit).toBe(20);
  });

  it.each(["0", "abc", ""])("leaves the persona's limits in place on an invalid override: %j", (value) => {
    const config = chatConfig({ CHAT_MAX_MESSAGE_CHARS: value, CHAT_MAX_OUTPUT_TOKENS: value });
    expect(config.maxMessageChars).toBeUndefined();
    expect(config.maxOutputTokens).toBeUndefined();
  });
});
