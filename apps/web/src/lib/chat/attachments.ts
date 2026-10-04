import { IMAGE_MEDIA_TYPES, type Attachment, type ChatTurn, type ImageMediaType } from "../llm";

// Files attached to chat messages. Shared by the chat page (checks a file before it is added, with
// the same rules and messages) and the chat route (checks everything again: a public endpoint).

export type AttachmentLimits = {
  /** Files per message. */
  maxFiles: number;
  /** Size of one file, in bytes. */
  maxFileBytes: number;
  /** All files in one request together (the whole history's), in bytes. */
  maxRequestBytes: number;
};

/** Text files are sent as their text; anything else must be an image or a PDF. */
const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json"];

/** For the file picker's `accept`: what can be attached. */
export const ATTACHMENT_ACCEPT = [...IMAGE_MEDIA_TYPES, "application/pdf", ...TEXT_EXTENSIONS].join(",");

/** What the visitor is told can be attached. */
export const ATTACHMENT_TYPES_LABEL = "images (PNG, JPEG, GIF, WebP), PDF, or text (.txt, .md, .csv, .json)";

/** The file's real type from its first bytes (not its name or the browser's guess), or undefined. */
export function sniffMediaType(bytes: Uint8Array): ImageMediaType | "application/pdf" | undefined {
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  const ascii = (from: number, text: string) => [...text].every((c, i) => bytes[from + i] === c.charCodeAt(0));
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return "image/gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(0, "%PDF-")) return "application/pdf";
  return undefined;
}

/** The first bytes of base64 data (enough to sniff), or an empty array if it isn't valid base64. */
function headOfBase64(data: string): Uint8Array {
  try {
    return Uint8Array.from(atob(data.slice(0, 24)), (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}

/** True when an attachment's content is what it claims: a real image of its type, a real PDF. */
export function attachmentContentMatches(attachment: Attachment): boolean {
  if (attachment.kind === "text") return true;
  const sniffed = sniffMediaType(headOfBase64(attachment.data));
  return attachment.kind === "pdf" ? sniffed === "application/pdf" : sniffed === attachment.mediaType;
}

/** An attachment's size in bytes: decoded from base64, or the text as UTF-8. */
export function attachmentBytes(attachment: Attachment): number {
  if (attachment.kind === "text") return new TextEncoder().encode(attachment.text).length;
  const { data } = attachment;
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

/** "820 KB", "4.8 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  // In chunks: String.fromCharCode with a whole file's bytes would overflow the call stack.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export type ReadAttachmentResult = { attachment: Attachment } | { error: string };

/**
 * Reads a file the visitor picked into an attachment, or says why it can't be attached: not an
 * allowed type (checked from its content), too big, or a text file that isn't UTF-8 text.
 */
export async function readAttachment(file: File, limits: AttachmentLimits): Promise<ReadAttachmentResult> {
  const name = file.name;
  if (file.size > limits.maxFileBytes) return { error: `${name} is too big: files can be up to ${formatBytes(limits.maxFileBytes)}.` };
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (TEXT_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension))) {
    try {
      return { attachment: { kind: "text", name, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) } };
    } catch {
      return { error: `${name} isn't a text file we can read (it must be UTF-8 text).` };
    }
  }

  const sniffed = sniffMediaType(bytes);
  if (sniffed === "application/pdf") return { attachment: { kind: "pdf", name, data: toBase64(bytes) } };
  if (sniffed) return { attachment: { kind: "image", name, mediaType: sniffed, data: toBase64(bytes) } };
  return { error: `${name} can't be attached. You can attach ${ATTACHMENT_TYPES_LABEL}.` };
}

/** All attachments in some turns together, in bytes. */
export const totalAttachmentBytes = (turns: ChatTurn[]) =>
  turns.reduce((sum, turn) => sum + (turn.attachments ?? []).reduce((s, a) => s + attachmentBytes(a), 0), 0);

/**
 * Keeps the files in a request within `maxRequestBytes`: the newest are kept, and older turns that
 * don't fit lose their files, with a note in their text so the model knows they were there.
 */
export function fitAttachments(turns: ChatTurn[], maxRequestBytes: number): ChatTurn[] {
  let budget = maxRequestBytes;
  const fitted = [...turns].reverse().map((turn) => {
    if (!turn.attachments?.length) return turn;
    const bytes = turn.attachments.reduce((sum, a) => sum + attachmentBytes(a), 0);
    if (bytes <= budget) {
      budget -= bytes;
      return turn;
    }
    const names = turn.attachments.map((a) => a.name).join(", ");
    return { role: turn.role, content: `${turn.content}\n\n[Files attached earlier, no longer available: ${names}]`.trim() };
  });
  return fitted.reverse();
}
