import type Anthropic from "@anthropic-ai/sdk";
import type { Content, Part } from "@google/genai";
import type OpenAI from "openai";
import { EFFORT_LEVELS, type Attachment, type ChatTurn, type Effort } from "./types";

// Each provider's message format, from the common ChatTurn. Pure (type-only SDK imports), so the
// mapping is unit-tested; the clients in ./clients call these. Files come before the text in a
// turn, as the providers recommend for images and documents.

/** A text file as text, for providers without a plain-text document part. */
export function textFilePart(attachment: Extract<Attachment, { kind: "text" }>): string {
  // The name can't end the tag early.
  const name = attachment.name.replace(/[<>"]/g, "");
  return `<file name="${name}">\n${attachment.text}\n</file>`;
}

/**
 * The effort levels a Claude model accepts, from its capabilities in the models API. Models without
 * effort (Claude Haiku 4.5, Sonnet 4.5) reject the setting, so they get none.
 */
export function anthropicEffortLevels(capabilities: Anthropic.ModelInfo["capabilities"]): Effort[] {
  const effort = capabilities?.effort;
  if (!effort?.supported) return [];
  return EFFORT_LEVELS.filter((level) => effort[level]?.supported);
}

const hasFiles = (turn: ChatTurn) => turn.role === "user" && !!turn.attachments?.length;

/** True when any turn carries files (the Anthropic client then turns on prompt caching). */
export const turnsHaveFiles = (turns: ChatTurn[]) => turns.some(hasFiles);

export function toAnthropicMessages(turns: ChatTurn[]): Anthropic.MessageParam[] {
  return turns.map((turn): Anthropic.MessageParam => {
    if (!hasFiles(turn)) return { role: turn.role, content: turn.content };
    const files = turn.attachments!.map((a): Anthropic.ContentBlockParam => {
      if (a.kind === "image") return { type: "image", source: { type: "base64", media_type: a.mediaType, data: a.data } };
      if (a.kind === "pdf") return { type: "document", title: a.name, source: { type: "base64", media_type: "application/pdf", data: a.data } };
      return { type: "document", title: a.name, source: { type: "text", media_type: "text/plain", data: a.text } };
    });
    // An empty text block is rejected: files alone are a valid message.
    return { role: "user", content: turn.content ? [...files, { type: "text", text: turn.content }] : files };
  });
}

export function toOpenAIMessages(system: string, turns: ChatTurn[]): OpenAI.ChatCompletionMessageParam[] {
  return [
    { role: "system", content: system },
    ...turns.map((turn): OpenAI.ChatCompletionMessageParam => {
      if (turn.role === "assistant") return { role: "assistant", content: turn.content };
      if (!hasFiles(turn)) return { role: "user", content: turn.content };
      const files = turn.attachments!.map((a): OpenAI.ChatCompletionContentPart => {
        if (a.kind === "image") return { type: "image_url", image_url: { url: `data:${a.mediaType};base64,${a.data}` } };
        if (a.kind === "pdf") return { type: "file", file: { filename: a.name, file_data: `data:application/pdf;base64,${a.data}` } };
        return { type: "text", text: textFilePart(a) };
      });
      return { role: "user", content: turn.content ? [...files, { type: "text", text: turn.content }] : files };
    }),
  ];
}

export function toGeminiContents(turns: ChatTurn[]): Content[] {
  return turns.map((turn): Content => {
    // Gemini calls the assistant "model".
    const role = turn.role === "assistant" ? "model" : "user";
    const files = (hasFiles(turn) ? turn.attachments! : []).map(
      (a): Part => (a.kind === "text" ? { text: textFilePart(a) } : { inlineData: { mimeType: a.kind === "pdf" ? "application/pdf" : a.mediaType, data: a.data } }),
    );
    return { role, parts: turn.content ? [...files, { text: turn.content }] : files };
  });
}
