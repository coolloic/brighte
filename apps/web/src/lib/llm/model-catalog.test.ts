import { afterEach, describe, expect, it, vi } from "vitest";
import { createModelCatalog, defaultModel } from "./model-catalog";
import { parseModelPatterns } from "./model-patterns";
import type { LlmClient, ModelInfo, ProviderId } from "./types";

function fakeClient(provider: ProviderId, listModels: () => Promise<ModelInfo[]>): LlmClient {
  return {
    provider,
    label: provider.toUpperCase(),
    listModels: vi.fn(listModels),
    async *streamChat() {
      throw new Error("not used");
    },
  };
}

const models = (...ids: string[]) => ids.map((id) => ({ id, label: id }));
const patterns = parseModelPatterns("anthropic:claude-haiku-*,openai:gpt-*-mini");

describe("model catalog", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists the allowed models of every provider", async () => {
    const anthropic = fakeClient("anthropic", async () => models("claude-haiku-4-5", "claude-opus-5"));
    const openai = fakeClient("openai", async () => models("gpt-5-mini", "gpt-5", "whisper-1"));
    const catalog = createModelCatalog({ clients: () => [anthropic, openai], patterns, ttlMs: 1000 });

    expect(await catalog.list()).toEqual([
      { provider: "anthropic", providerLabel: "ANTHROPIC", id: "claude-haiku-4-5", label: "claude-haiku-4-5" },
      { provider: "openai", providerLabel: "OPENAI", id: "gpt-5-mini", label: "gpt-5-mini" },
    ]);
    expect(await catalog.find("openai", "gpt-5-mini")).toMatchObject({ id: "gpt-5-mini" });
    // A model the provider offers but the patterns don't allow can't be picked.
    expect(await catalog.find("anthropic", "claude-opus-5")).toBeUndefined();
  });

  it("caches the list until it expires, sharing one refresh between callers", async () => {
    let time = 0;
    const client = fakeClient("anthropic", async () => models("claude-haiku-4-5"));
    const catalog = createModelCatalog({ clients: () => [client], patterns, ttlMs: 1000, now: () => time });

    await Promise.all([catalog.list(), catalog.list()]);
    time = 999;
    await catalog.list();
    expect(client.listModels).toHaveBeenCalledTimes(1);
    time = 1000;
    await catalog.list();
    expect(client.listModels).toHaveBeenCalledTimes(2);
  });

  it("leaves out a failing provider and retries it sooner", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let time = 0;
    const broken = fakeClient("openai", async () => {
      throw new Error("401");
    });
    const working = fakeClient("anthropic", async () => models("claude-haiku-4-5"));
    const catalog = createModelCatalog({ clients: () => [working, broken], patterns, ttlMs: 60_000, retryMs: 100, now: () => time });

    expect((await catalog.list()).map((option) => option.id)).toEqual(["claude-haiku-4-5"]);
    time = 100;
    await catalog.list();
    expect(broken.listModels).toHaveBeenCalledTimes(2);
  });
});

describe("defaultModel", () => {
  const options = [
    { provider: "openai", providerLabel: "OpenAI", id: "gpt-5-mini", label: "gpt-5-mini" },
    { provider: "anthropic", providerLabel: "Anthropic", id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ] as const;

  it("prefers an exact match, then a prefix match, then the first option", () => {
    expect(defaultModel([...options], "openai:gpt-5-mini")?.id).toBe("gpt-5-mini");
    expect(defaultModel([...options], "anthropic:claude-haiku-4-5")?.id).toBe("claude-haiku-4-5-20251001");
    expect(defaultModel([...options], "gemini:gemini-2.5-flash")?.id).toBe("gpt-5-mini");
    expect(defaultModel([], "anthropic:claude-haiku-4-5")).toBeUndefined();
  });
});
