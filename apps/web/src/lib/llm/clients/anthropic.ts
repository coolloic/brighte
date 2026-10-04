import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatRequest, LlmClient, ModelInfo } from "../types";

/** Claude, through the official SDK. ANTHROPIC_BASE_URL (read by the SDK) points it elsewhere, e.g. the e2e mock. */
export class AnthropicClient implements LlmClient {
  readonly provider = "anthropic";
  readonly label = "Anthropic";
  readonly #sdk: Anthropic;

  constructor(apiKey: string) {
    this.#sdk = new Anthropic({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    for await (const model of this.#sdk.models.list()) models.push({ id: model.id, label: model.display_name });
    return models;
  }

  async *streamChat({ model, system, messages, maxOutputTokens, signal }: ChatRequest): AsyncIterable<string> {
    const stream = this.#sdk.messages.stream({ model, max_tokens: maxOutputTokens, system, messages }, { signal });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
    }
  }
}
