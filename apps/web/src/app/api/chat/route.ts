import { chatConfig } from "@/lib/chat/config";
import { handleChat } from "@/lib/chat/handle-chat";
import { getPersona } from "@/lib/chat/personas";
import { createRateLimiter } from "@/lib/chat/rate-limit";
import { modelCatalog } from "@/lib/llm/catalog";
import { getClient } from "@/lib/llm/registry";

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
