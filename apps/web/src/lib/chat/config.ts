import { DEFAULT_MODEL_PATTERNS } from "../llm/model-patterns";

type Env = Record<string, string | undefined>;

/** A whole number of 1 or more from env; anything else (unset, 0, "abc", 1.5) falls back. */
function positiveInt(env: Env, name: string, fallback: number): number {
  const value = Number(env[name]);
  return env[name] && Number.isInteger(value) && value > 0 ? value : fallback;
}

export type ChatConfig = ReturnType<typeof chatConfig>;

/** The chatbot's settings from the root .env (see .env.example). Read on each use, so tests can pass their own env. */
export function chatConfig(env: Env = process.env) {
  return {
    /** Messages one visitor may send per window (each costs API money). */
    rateLimit: positiveInt(env, "CHAT_RATE_LIMIT", 20),
    rateLimitWindowSeconds: positiveInt(env, "CHAT_RATE_LIMIT_WINDOW_SECONDS", 600),
    /** Longest message a visitor may send, in characters. */
    maxMessageChars: positiveInt(env, "CHAT_MAX_MESSAGE_CHARS", 1000),
    /** Cap on each reply's length, in tokens: bounds the cost of one message. */
    maxOutputTokens: positiveInt(env, "CHAT_MAX_OUTPUT_TOKENS", 1024),
    /** Which discovered models visitors may pick (src/lib/llm/model-patterns.ts). */
    modelPatterns: env.CHAT_MODELS?.trim() || DEFAULT_MODEL_PATTERNS,
    /** How long the model list is kept before asking the providers again. */
    modelsCacheSeconds: positiveInt(env, "CHAT_MODELS_CACHE_SECONDS", 3600),
    /** The picker's starting model, "provider:model". */
    defaultModel: env.CHAT_DEFAULT_MODEL?.trim() || "anthropic:claude-haiku-4-5",
    /** Which persona answers (src/lib/chat/personas.ts). */
    persona: env.CHAT_PERSONA?.trim() || "brighte",
  };
}
