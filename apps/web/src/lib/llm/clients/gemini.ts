import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { ChatRequest, LlmClient, ModelInfo } from "../types";

/** Google Gemini, through the official @google/genai SDK. */
export class GeminiClient implements LlmClient {
  readonly provider = "gemini";
  readonly label = "Google Gemini";
  readonly #sdk: GoogleGenAI;

  constructor(apiKey: string) {
    this.#sdk = new GoogleGenAI({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    for await (const model of await this.#sdk.models.list()) {
      // Only models that can chat; names come as "models/gemini-2.5-flash".
      if (!model.name || !model.supportedActions?.includes("generateContent")) continue;
      const id = model.name.replace(/^models\//, "");
      models.push({ id, label: model.displayName ?? id });
    }
    return models;
  }

  async *streamChat({ model, system, messages, maxOutputTokens, signal }: ChatRequest): AsyncIterable<string> {
    const stream = await this.#sdk.models.generateContentStream({
      model,
      // Gemini calls the assistant "model".
      contents: messages.map(({ role, content }) => ({ role: role === "assistant" ? "model" : "user", parts: [{ text: content }] })),
      config: { systemInstruction: system, maxOutputTokens, abortSignal: signal },
    });
    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  }
}
