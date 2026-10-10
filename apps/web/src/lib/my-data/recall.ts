import type { ChatTurn } from "../llm";
import { conversationEmail, hasProfile } from "./email";

// The chat's recall (RAG): for a visitor who gave their email, what they saved, added to the system
// prompt for this reply. Their newest profile when the conversation has none yet, and the saved
// chunks closest to their latest message.

export type RecallSources = {
  getMyData: (email: string) => Promise<{ profile: unknown } | null>;
  searchMyData: (email: string, query: string, limit: number) => Promise<{ text: string; document: { kind: string; title: string; createdAt: string } }[]>;
};

const MATCHES = 6;
const MAX_QUERY_LENGTH = 2000;
/** Recall is a bonus: a slow API mustn't hold up the reply for long. */
export const RECALL_TIMEOUT_MS = 3000;

const KIND_LABELS: Record<string, string> = { PROFILE: "Profile", TAILORED_CV: "Tailored CV", COVER_LETTER: "Cover letter" };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" });

/** The text to add to the system prompt, or undefined when there's no email, nothing saved, or the API failed. */
export async function recall(turns: ChatTurn[], sources: RecallSources, timeoutMs = RECALL_TIMEOUT_MS): Promise<string | undefined> {
  const email = conversationEmail(turns);
  if (!email) return undefined;
  const latest = turns.findLast((turn) => turn.role === "user");
  const query = (latest?.content.trim() || "work experience and skills").slice(0, MAX_QUERY_LENGTH);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`Recall took over ${timeoutMs} ms`)), timeoutMs)));
  try {
    const [saved, matches] = await Promise.race([Promise.all([sources.getMyData(email), sources.searchMyData(email, query, MATCHES)]), timeout]);
    const parts: string[] = [];
    if (saved?.profile && !hasProfile(turns)) {
      parts.push(`The visitor's saved profile (${email}), in the profile format:\n\n${JSON.stringify(saved.profile)}`);
    }
    if (matches.length) {
      const lines = matches.map((match) => `- [${KIND_LABELS[match.document.kind] ?? match.document.kind}: ${match.document.title}, saved ${day(match.document.createdAt)}] ${match.text}`);
      parts.push(`From the visitor's saved data (${email}), most relevant first:\n${lines.join("\n")}`);
    }
    return parts.length ? parts.join("\n\n") : undefined;
  } catch (cause) {
    console.error("Recalling my data failed:", cause);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
