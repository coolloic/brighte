import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatRequest, LlmClient, ModelOption } from "../llm";
import { handleChat, type ChatHandlerDeps } from "./handle-chat";

const HAIKU: ModelOption = { provider: "anthropic", providerLabel: "Anthropic", id: "claude-haiku-4-5", label: "Claude Haiku 4.5" };

function fakeClient(stream: (request: ChatRequest) => AsyncIterable<string>): LlmClient & { streamChat: ReturnType<typeof vi.fn> } {
  return { provider: "anthropic", label: "Anthropic", listModels: async () => [HAIKU], streamChat: vi.fn(stream) };
}

async function* reply(...chunks: string[]) {
  for (const chunk of chunks) yield chunk;
}

function deps(client: LlmClient, overrides: Partial<ChatHandlerDeps> = {}): ChatHandlerDeps {
  return {
    catalog: { find: async (provider, id) => (provider === HAIKU.provider && id === HAIKU.id ? HAIKU : undefined) },
    getClient: () => client,
    takeRateLimit: () => ({ ok: true }),
    system: "Be brief.",
    maxMessageChars: 100,
    maxOutputTokens: 256,
    trustedHops: 1,
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = { provider: "anthropic", model: "claude-haiku-4-5", messages: [{ role: "user", content: "Hi" }] };

describe("handleChat", () => {
  afterEach(() => vi.restoreAllMocks());

  it("streams the chosen model's reply, with the persona and limits", async () => {
    const client = fakeClient(() => reply("Hel", "lo!"));
    const response = await handleChat(post(valid), deps(client));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe("Hello!");
    expect(client.streamChat).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5", system: "Be brief.", maxOutputTokens: 256, messages: valid.messages }),
    );
  });

  it.each([
    ["not JSON", post("{", {})],
    ["an invalid body", post({ ...valid, messages: [{ role: "user", content: "x".repeat(101) }] })],
  ])("rejects %s", async (_, request) => {
    const client = fakeClient(() => reply("never"));
    const response = await handleChat(request, deps(client));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "BAD_REQUEST" });
    expect(client.streamChat).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content type (cross-site form posts)", async () => {
    const response = await handleChat(post(JSON.stringify(valid), { "content-type": "text/plain" }), deps(fakeClient(() => reply())));
    expect(response.status).toBe(415);
  });

  it("refuses a model visitors may not pick", async () => {
    const client = fakeClient(() => reply("never"));
    const response = await handleChat(post({ ...valid, model: "claude-opus-5" }), deps(client));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "MODEL_UNAVAILABLE" });
    expect(client.streamChat).not.toHaveBeenCalled();
  });

  it("rate-limits per visitor IP, with Retry-After", async () => {
    const takeRateLimit = vi.fn(() => ({ ok: false as const, retryAfterSeconds: 42 }));
    const client = fakeClient(() => reply("never"));
    const response = await handleChat(post(valid), deps(client, { takeRateLimit }));

    expect(takeRateLimit).toHaveBeenCalledWith("203.0.113.7");
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(await response.json()).toEqual({ code: "RATE_LIMITED", retryAfterSeconds: 42 });
    expect(client.streamChat).not.toHaveBeenCalled();
  });

  it("answers 502 when the provider fails before replying", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = fakeClient(async function* () {
      throw new Error("invalid x-api-key");
    });
    const response = await handleChat(post(valid), deps(client));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: "PROVIDER_ERROR" });
  });
});
