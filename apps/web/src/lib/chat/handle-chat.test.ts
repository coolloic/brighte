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
    limits: { maxMessageChars: 100, maxFiles: 2, maxFileBytes: 1000, maxRequestBytes: 1500 },
    maxOutputTokens: 256,
    effort: "low",
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

// The first bytes of a real PNG.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString("base64");

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
      expect.objectContaining({ model: "claude-haiku-4-5", system: "Be brief.", maxOutputTokens: 256, effort: "low", messages: valid.messages }),
    );
  });

  it("adds what recall finds (my data) to the system prompt for this reply", async () => {
    const client = fakeClient(() => reply("ok"));
    const recall = vi.fn(async () => "From the visitor's saved data: React rebuild.");
    await (await handleChat(post(valid), deps(client, { recall }))).text();
    expect(recall).toHaveBeenCalledWith(valid.messages, expect.any(Request));
    expect(client.streamChat).toHaveBeenCalledWith(expect.objectContaining({ system: "Be brief.\n\nFrom the visitor's saved data: React rebuild." }));
  });

  it("keeps the persona's system prompt alone when recall finds nothing", async () => {
    const client = fakeClient(() => reply("ok"));
    await (await handleChat(post(valid), deps(client, { recall: async () => undefined }))).text();
    expect(client.streamChat).toHaveBeenCalledWith(expect.objectContaining({ system: "Be brief." }));
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

  it("passes a message's files to the model", async () => {
    const client = fakeClient(() => reply("A menu."));
    const files = [
      { kind: "image", name: "photo.png", mediaType: "image/png", data: PNG },
      { kind: "text", name: "notes.md", text: "# Notes" },
    ];
    const response = await handleChat(post({ ...valid, messages: [{ role: "user", content: "What is this?", attachments: files }] }), deps(client));

    expect(response.status).toBe(200);
    expect(client.streamChat).toHaveBeenCalledWith(expect.objectContaining({ messages: [{ role: "user", content: "What is this?", attachments: files }] }));
  });

  it("refuses a file whose content isn't what it claims", async () => {
    const client = fakeClient(() => reply("never"));
    const fake = { kind: "image", name: "photo.png", mediaType: "image/png", data: btoa("MZ this is a program") };
    const response = await handleChat(post({ ...valid, messages: [{ role: "user", content: "Hi", attachments: [fake] }] }), deps(client));
    expect(response.status).toBe(400);
    expect(client.streamChat).not.toHaveBeenCalled();
  });

  it("refuses a body bigger than the file limits allow, before parsing it", async () => {
    const client = fakeClient(() => reply("never"));
    // maxRequestBytes 1500: the cap is its base64 size plus 1 MB for the conversation's text.
    const huge = "x".repeat(2 * 1024 * 1024);
    const response = await handleChat(post({ ...valid, messages: [{ role: "user", content: huge }] }), deps(client));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ code: "FILES_TOO_LARGE" });
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
