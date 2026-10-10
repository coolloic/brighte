import { chatConfig, configuredPersona, createRateLimiter, handleChat } from "@/lib/chat/server";
import { getClient, modelCatalog } from "@/lib/llm/server";
import { getMyData, searchMyData } from "@/lib/api/server";
import { recall } from "@/lib/my-data/server";

// Settings are read once, when the server starts (root .env).
const config = chatConfig();
const persona = configuredPersona(config);
const takeRateLimit = createRateLimiter({ limit: config.rateLimit, windowMs: config.rateLimitWindowSeconds * 1000 });

/** The chatbot: streams the picked model's reply. The browser calls this; the provider API keys never leave the server. */
export function POST(request: Request) {
  return handleChat(request, {
    catalog: modelCatalog,
    getClient,
    takeRateLimit,
    system: persona.system,
    limits: { ...config, maxMessageChars: persona.maxMessageChars },
    maxOutputTokens: persona.maxOutputTokens,
    effort: config.effort,
    trustedHops: Number(process.env.WEB_TRUST_PROXY ?? 0),
    recall: config.myData
      ? (messages, request) =>
          recall(messages, {
            getMyData: (email) => getMyData(email, request.headers),
            searchMyData: (email, query, limit) => searchMyData(email, query, limit, request.headers),
          })
      : undefined,
  });
}
