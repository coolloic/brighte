import "server-only";
import OpenAI from "openai";
import type { ChatRequest, LlmClient, ModelInfo } from "../types";

/**
 * OpenAI, through the official SDK's Chat Completions API. Its models API returns every model
 * (embeddings, TTS, images too) with no capability flags, so CHAT_MODELS patterns pick the chat ones.
 */
export class OpenAIClient implements LlmClient {
  readonly provider = "openai";
  readonly label = "OpenAI";
  readonly #sdk: OpenAI;

  constructor(apiKey: string) {
    this.#sdk = new OpenAI({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    for await (const model of this.#sdk.models.list()) models.push({ id: model.id, label: model.id });
    return models;
  }

  async *streamChat({ model, system, messages, maxOutputTokens, signal }: ChatRequest): AsyncIterable<string> {
    const stream = await this.#sdk.chat.completions.create(
      { model, stream: true, max_completion_tokens: maxOutputTokens, messages: [{ role: "system", content: system }, ...messages] },
      { signal },
    );
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  }
}
