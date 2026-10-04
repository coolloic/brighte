import { z } from "zod";
import { PROVIDER_IDS, type ChatTurn } from "../llm";

// Shared by the chat route and the chat page (no server-only imports): the browser checks a
// message with the same rules first, so a mistake never costs a request or a rate-limit hit.

/** Turns sent with each message: enough context for a chat, while bounding each request's cost. */
export const MAX_HISTORY = 20;

/** Longest earlier assistant reply accepted back from the browser (a reply is capped in tokens; this is generous). */
const MAX_REPLY_CHARS = 16_000;

/** What's wrong with a message the visitor typed, or undefined when it can be sent. */
export function messageError(text: string, maxChars: number): string | undefined {
  const length = text.trim().length;
  if (length === 0) return "Type a message first.";
  if (length > maxChars) return `Keep your message to ${maxChars} characters (it has ${length}).`;
  return undefined;
}

/** The last MAX_HISTORY turns, starting with a user turn (every provider wants one first). */
export function recentHistory(messages: ChatTurn[]): ChatTurn[] {
  const recent = messages.slice(-MAX_HISTORY);
  return recent[0]?.role === "assistant" ? recent.slice(1) : recent;
}

/**
 * The chat route's request body. A public endpoint: everything is checked, including that turns
 * alternate user/assistant and end with the visitor's new message, so a client can't send a long
 * made-up history to run up the bill.
 */
export function chatRequestSchema(maxMessageChars: number) {
  const turn = z.discriminatedUnion("role", [
    z.object({ role: z.literal("user"), content: z.string().trim().min(1).max(maxMessageChars) }),
    z.object({ role: z.literal("assistant"), content: z.string().min(1).max(MAX_REPLY_CHARS) }),
  ]);
  return z.object({
    provider: z.enum(PROVIDER_IDS),
    model: z.string().min(1).max(200),
    messages: z
      .array(turn)
      .min(1)
      .max(MAX_HISTORY)
      .refine((turns) => turns.every((t, i) => t.role === (i % 2 === 0 ? "user" : "assistant")), "Turns must alternate, starting with the user")
      .refine((turns) => turns.at(-1)?.role === "user", "The last turn must be the user's"),
  });
}

export type ChatRequestBody = z.infer<ReturnType<typeof chatRequestSchema>>;
