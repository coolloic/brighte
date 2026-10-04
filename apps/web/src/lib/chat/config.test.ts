import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_PATTERNS } from "../llm";
import { chatConfig } from "./config";

describe("chatConfig", () => {
  it("has defaults", () => {
    expect(chatConfig({})).toEqual({
      rateLimit: 20,
      rateLimitWindowSeconds: 600,
      maxMessageChars: 1000,
      maxOutputTokens: 1024,
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

  it.each(["0", "-1", "1.5", "abc", ""])("falls back on an invalid number: %j", (value) => {
    expect(chatConfig({ CHAT_RATE_LIMIT: value }).rateLimit).toBe(20);
  });
});
