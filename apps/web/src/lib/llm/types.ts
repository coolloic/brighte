// The LLM layer's contract. The chat route talks only to LlmClient; each provider's client
// (src/lib/llm/clients/) wraps its own SDK behind it. No server-only imports: the browser uses
// ModelOption for the model picker.

export const PROVIDER_IDS = ["anthropic", "openai", "gemini"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatRequest = {
  /** The provider's own model id, e.g. "claude-haiku-4-5". */
  model: string;
  system: string;
  /** Oldest first, starting with a user turn. */
  messages: ChatTurn[];
  maxOutputTokens: number;
  /** Aborted when the visitor leaves or stops the reply. */
  signal?: AbortSignal;
};

export type ModelInfo = { id: string; label: string };

/** One LLM provider. Implementations own their SDK, credentials and request mapping. */
export interface LlmClient {
  readonly provider: ProviderId;
  /** Shown in the model picker, e.g. "Anthropic". */
  readonly label: string;
  /** Every model the provider offers this API key, as reported by its models API. */
  listModels(): Promise<ModelInfo[]>;
  /** Streams the assistant's reply as text chunks. Throws (or the iterator rejects) on provider errors. */
  streamChat(request: ChatRequest): AsyncIterable<string>;
}

/** A model the visitor may pick: what the picker shows and what the browser sends back. */
export type ModelOption = { provider: ProviderId; providerLabel: string; id: string; label: string };

/** The picker's value for a model, e.g. "anthropic:claude-haiku-4-5". */
export const modelKey = ({ provider, id }: { provider: ProviderId; id: string }) => `${provider}:${id}`;
