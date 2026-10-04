import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicEffortLevels, toAnthropicMessages, turnsHaveFiles } from "../content";
import type { ChatRequest, Effort, LlmClient, ModelInfo } from "../types";

/** Claude, through the official SDK. ANTHROPIC_BASE_URL (read by the SDK) points it elsewhere, e.g. the e2e mock. */
export class AnthropicClient implements LlmClient {
  readonly provider = "anthropic";
  readonly label = "Anthropic";
  readonly #sdk: Anthropic;
  /** Effort levels per model, from the models list (which the catalog loads before any chat). */
  readonly #effortLevels = new Map<string, Effort[]>();

  constructor(apiKey: string) {
    this.#sdk = new Anthropic({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    for await (const model of this.#sdk.models.list()) {
      models.push({ id: model.id, label: model.display_name });
      this.#effortLevels.set(model.id, anthropicEffortLevels(model.capabilities));
    }
    return models;
  }

  async *streamChat({ model, system, messages, maxOutputTokens, effort, signal }: ChatRequest): AsyncIterable<string> {
    // Newer models think before answering, and thinking counts toward max_tokens: a lower effort
    // keeps replies quick and cheap, and within the cap. Only for models that accept the level.
    const withEffort = effort && this.#effortLevels.get(model)?.includes(effort);
    const stream = this.#sdk.messages.stream(
      {
        model,
        max_tokens: maxOutputTokens,
        system,
        messages: toAnthropicMessages(messages),
        // Files are re-sent with every message while in context: cache the conversation so far, so
        // re-reading it within 5 minutes costs about a tenth (automatic caching: the breakpoint moves
        // forward each turn). Plain chats skip it: short prefixes wouldn't cache anyway.
        ...(turnsHaveFiles(messages) && { cache_control: { type: "ephemeral" as const } }),
        ...(withEffort && { output_config: { effort } }),
      },
      { signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
    }
  }
}
