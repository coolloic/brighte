import { blockContents, parseProfileBlock, PROFILE_BLOCK } from "../chat";
import type { ChatTurn } from "../llm";

// Whose saved data the chat may use: the email the visitor gave in this conversation.

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

/** An email as the API keys it: trimmed and lowercase. */
export const normaliseEmail = (email: string) => email.trim().toLowerCase();

/**
 * The newest profile's email in the conversation, else the newest email address the visitor wrote
 * in a message. Undefined when there is neither.
 */
export function conversationEmail(turns: ChatTurn[]): string | undefined {
  for (const turn of turns.toReversed()) {
    if (turn.role !== "assistant") continue;
    const profile = blockContents(turn.content, PROFILE_BLOCK).map(parseProfileBlock).findLast(Boolean);
    const found = profile?.basics.email?.match(EMAIL);
    if (found) return normaliseEmail(found[0]);
  }
  for (const turn of turns.toReversed()) {
    if (turn.role !== "user") continue;
    const found = turn.content.match(EMAIL);
    if (found) return normaliseEmail(found.at(-1)!);
  }
  return undefined;
}

/** True when the conversation already has a valid profile block. */
export function hasProfile(turns: ChatTurn[]): boolean {
  return turns.some((turn) => turn.role === "assistant" && blockContents(turn.content, PROFILE_BLOCK).some((code) => parseProfileBlock(code) !== undefined));
}
