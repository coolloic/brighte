import { clientIp } from "../api";
import type { Effort, LlmClient, ModelCatalog, ProviderId } from "../llm";
import type { ChatErrorBody } from "./chat-error";
import { chatRequestSchema, type ChatRequestLimits } from "./messages";
import { readJson } from "./read-json";
import type { RateLimitResult } from "./rate-limit";

export type ChatHandlerDeps = {
  catalog: Pick<ModelCatalog, "find">;
  getClient: (provider: ProviderId) => LlmClient | undefined;
  takeRateLimit: (key: string) => RateLimitResult;
  system: string;
  limits: ChatRequestLimits;
  maxOutputTokens: number;
  effort?: Effort;
  /** Proxies whose X-Forwarded-For entries are trusted (WEB_TRUST_PROXY, see client-ip.ts). */
  trustedHops: number;
};

function errorResponse(status: number, body: ChatErrorBody, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

/**
 * POST /api/chat: checks the request, the model (visitors may only pick listed models) and the
 * visitor's rate limit, then streams the reply as plain text. Errors are JSON `{ code }`, turned
 * into words by the page (chatErrorMessage).
 */
export async function handleChat(request: Request, deps: ChatHandlerDeps): Promise<Response> {
  // JSON only: a cross-site page can't send that without a CORS preflight, which this route never allows.
  if (!request.headers.get("content-type")?.startsWith("application/json")) return errorResponse(415, { code: "BAD_REQUEST" });

  // The files as base64 (4/3 of their size) plus room for the conversation's text.
  const read = await readJson(request, Math.ceil((deps.limits.maxRequestBytes * 4) / 3) + 1024 * 1024);
  if (read === "too-large") return errorResponse(413, { code: "FILES_TOO_LARGE" });
  if (read === "invalid") return errorResponse(400, { code: "BAD_REQUEST" });
  const parsed = chatRequestSchema(deps.limits).safeParse(read.json);
  if (!parsed.success) return errorResponse(400, { code: "BAD_REQUEST" });
  const { provider, model, messages } = parsed.data;

  const client = (await deps.catalog.find(provider, model)) && deps.getClient(provider);
  if (!client) return errorResponse(400, { code: "MODEL_UNAVAILABLE" });

  // Counted only for requests that reach the model: those cost money. Without a trusted proxy (local
  // development) there is no visitor IP, and everyone shares one count.
  const visitor = clientIp(request.headers.get("x-forwarded-for"), deps.trustedHops) ?? "unknown";
  const limit = deps.takeRateLimit(visitor);
  if (!limit.ok) {
    return errorResponse(429, { code: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds }, { "retry-after": String(limit.retryAfterSeconds) });
  }

  const chunks = client
    .streamChat({ model, system: deps.system, messages, maxOutputTokens: deps.maxOutputTokens, effort: deps.effort, signal: request.signal })
    [Symbol.asyncIterator]();
  // Wait for the first chunk, so a provider failure (bad key, model retired, outage) is an error
  // status the page can explain, not a stream that breaks before saying anything.
  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (error) {
    console.error(`Chat with ${provider}:${model} failed:`, error);
    return errorResponse(502, { code: "PROVIDER_ERROR" });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (first.done) controller.close();
      else controller.enqueue(encoder.encode(first.value));
    },
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value));
      } catch (error) {
        // Mid-reply: the page keeps what arrived and says the reply was cut off. Not logged when the
        // visitor stopped it or left: that isn't a failure.
        if (!request.signal.aborted) console.error(`Chat with ${provider}:${model} broke off:`, error);
        controller.error(error);
      }
    },
    // The visitor left or pressed Stop: stop the provider's stream too.
    async cancel() {
      await chunks.return?.();
    },
  });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
