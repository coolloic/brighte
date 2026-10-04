import { chatConfig, createRateLimiter, getPersona, handleChat } from "@/lib/chat/server";
import { getClient, modelCatalog } from "@/lib/llm/server";

// Settings are read once, when the server starts (root .env).
const config = chatConfig();
const takeRateLimit = createRateLimiter({ limit: config.rateLimit, windowMs: config.rateLimitWindowSeconds * 1000 });

/** The chatbot: streams the picked model's reply. The browser calls this; the provider API keys never leave the server. */
export function POST(request: Request) {
  return handleChat(request, {
    catalog: modelCatalog,
    getClient,
    takeRateLimit,
    system: getPersona(config.persona).system,
    maxMessageChars: config.maxMessageChars,
    maxOutputTokens: config.maxOutputTokens,
    trustedHops: Number(process.env.WEB_TRUST_PROXY ?? 0),
  });
}
