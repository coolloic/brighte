import { z } from "zod";
import { IMAGE_MEDIA_TYPES, PROVIDER_IDS, type ChatTurn } from "../llm";
import { attachmentBytes, attachmentContentMatches, totalAttachmentBytes, type AttachmentLimits } from "./attachments";

// Shared by the chat route and the chat page (no server-only imports): the browser checks a
// message with the same rules first, so a mistake never costs a request or a rate-limit hit.

/** Turns sent with each message: enough context for a chat, while bounding each request's cost. */
export const MAX_HISTORY = 20;

/** Longest earlier assistant reply accepted back from the browser: a 4,096-token reply full of JSON fits. */
const MAX_REPLY_CHARS = 40_000;

/** What's wrong with a message the visitor typed, or undefined when it can be sent. Files alone are a message too. */
export function messageError(text: string, maxChars: number, attachmentCount = 0): string | undefined {
  const length = text.trim().length;
  if (length === 0 && attachmentCount === 0) return "Type a message first.";
  if (length > maxChars) return `Keep your message to ${maxChars} characters (it has ${length}).`;
  return undefined;
}

/** The last MAX_HISTORY turns, starting with a user turn (every provider wants one first). */
export function recentHistory(messages: ChatTurn[]): ChatTurn[] {
  const recent = messages.slice(-MAX_HISTORY);
  return recent[0]?.role === "assistant" ? recent.slice(1) : recent;
}

export type ChatRequestLimits = AttachmentLimits & { maxMessageChars: number };

/**
 * The chat route's request body. A public endpoint: everything is checked, including that turns
 * alternate user/assistant and end with the visitor's new message, so a client can't send a long
 * made-up history to run up the bill, and that every file is what it claims (by its content) and
 * within the size limits.
 */
export function chatRequestSchema({ maxMessageChars, maxFiles, maxFileBytes, maxRequestBytes }: ChatRequestLimits) {
  // base64 is 4 characters per 3 bytes.
  const maxBase64 = Math.ceil(maxFileBytes / 3) * 4;
  const name = z.string().trim().min(1).max(255);
  const attachment = z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("image"), name, mediaType: z.enum(IMAGE_MEDIA_TYPES), data: z.base64().max(maxBase64) }),
      z.object({ kind: z.literal("pdf"), name, data: z.base64().max(maxBase64) }),
      z.object({ kind: z.literal("text"), name, text: z.string().max(maxFileBytes) }),
    ])
    .refine((a) => attachmentBytes(a) <= maxFileBytes, "File too big")
    .refine(attachmentContentMatches, "File content doesn't match its type");
  const turn = z.discriminatedUnion("role", [
    // Strict: unknown fields (e.g. files on an assistant turn) are refused, not silently dropped.
    z
      .strictObject({
        role: z.literal("user"),
        content: z.string().trim().max(maxMessageChars),
        attachments: z.array(attachment).min(1).max(maxFiles).optional(),
      })
      .refine((t) => t.content.length > 0 || t.attachments, "A message needs text or files"),
    z.strictObject({ role: z.literal("assistant"), content: z.string().min(1).max(MAX_REPLY_CHARS) }),
  ]);
  return z.object({
    provider: z.enum(PROVIDER_IDS),
    model: z.string().min(1).max(200),
    messages: z
      .array(turn)
      .min(1)
      .max(MAX_HISTORY)
      .refine((turns) => turns.every((t, i) => t.role === (i % 2 === 0 ? "user" : "assistant")), "Turns must alternate, starting with the user")
      .refine((turns) => turns.at(-1)?.role === "user", "The last turn must be the user's")
      .refine((turns) => totalAttachmentBytes(turns) <= maxRequestBytes, "Files too big together"),
  });
}

export type ChatRequestBody = z.infer<ReturnType<typeof chatRequestSchema>>;
