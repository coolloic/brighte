import { DEFAULT_MODEL_PATTERNS, EFFORT_LEVELS, type Effort } from "../llm";

type Env = Record<string, string | undefined>;

const MB = 1024 * 1024;

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
    /** Files a visitor may attach to one message, and their sizes (bytes). */
    maxFiles: positiveInt(env, "CHAT_MAX_FILES", 3),
    maxFileBytes: positiveInt(env, "CHAT_MAX_FILE_MB", 5) * MB,
    /** All files in one request together, the whole history's (they are re-sent while in context). */
    maxRequestBytes: positiveInt(env, "CHAT_MAX_REQUEST_MB", 10) * MB,
    /** Cap on each reply's length, in tokens: bounds the cost of one message. */
    maxOutputTokens: positiveInt(env, "CHAT_MAX_OUTPUT_TOKENS", 1024),
    /**
     * How much models think before answering, where they support it (low, medium, high, xhigh, max):
     * low keeps replies quick, cheap and within CHAT_MAX_OUTPUT_TOKENS. Anything else falls back to low.
     */
    effort: (EFFORT_LEVELS as readonly string[]).includes(env.CHAT_EFFORT?.trim() ?? "") ? (env.CHAT_EFFORT!.trim() as Effort) : "low",
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
