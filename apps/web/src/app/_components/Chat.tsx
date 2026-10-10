"use client";

import { useRef, useState } from "react";
import { ChatWindow, type ChatMessage } from "@/components/organisms/ChatWindow";
import {
  ATTACHMENT_ACCEPT,
  attachmentBytes,
  chatErrorMessage,
  fitAttachments,
  formatBytes,
  messageError,
  readAttachment,
  recentHistory,
  totalAttachmentBytes,
  type AttachmentLimits,
  type ChatErrorBody,
  type ChatErrorCode,
} from "@/lib/chat";
import { modelKey, type Attachment, type ChatTurn, type ModelOption } from "@/lib/llm";
import { cvActions } from "./cv-files";

export type ChatProps = {
  assistantName: string;
  greeting: string;
  suggestions: string[];
  models: ModelOption[];
  defaultModel: string;
  maxChars: number;
  limits: AttachmentLimits;
  /** "My data" is on (MY_DATA=on): the cards offer "Save to my data". */
  myData?: boolean;
};

/** A message as the page keeps it: with its files, which are re-sent while in context. */
type Message = ChatMessage & { files?: Attachment[] };

/** How a file shows in a chip: thumbnail for images, size for all. */
const fileView = (attachment: Attachment) => ({
  name: attachment.name,
  kind: attachment.kind,
  detail: formatBytes(attachmentBytes(attachment)),
  previewSrc: attachment.kind === "image" ? `data:${attachment.mediaType};base64,${attachment.data}` : undefined,
});

type Failure = { message: string; retryable: boolean };

const failure = (body: ChatErrorBody): Failure => ({ message: chatErrorMessage(body), retryable: body.code !== "RATE_LIMITED" });

/**
 * The chat page's state: the conversation (in this tab only), the picked model, files waiting to be
 * sent, and one streaming reply at a time. Sends the recent history, with its files, to /api/chat
 * and shows the reply as it arrives. Files stay in the conversation (re-sent with each message, so
 * the model can be asked about them later) until they fall outside the history or the size budget.
 */
export function Chat({ assistantName, greeting, suggestions, models, defaultModel, maxChars, limits, myData = false }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<{ id: string; attachment: Attachment }[]>([]);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string>();
  const [model, setModel] = useState(defaultModel);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<Failure>();
  const abort = useRef<AbortController>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  /** Streams the assistant's reply to `conversation` (which ends with the visitor's message). */
  async function reply(conversation: Message[]) {
    const option = models.find((candidate) => modelKey(candidate) === model);
    if (!option) return;
    const replyId = crypto.randomUUID();
    setMessages([...conversation, { id: replyId, from: "assistant", text: "" }]);
    setStreaming(true);
    setError(undefined);
    const controller = new AbortController();
    abort.current = controller;

    const appendText = (text: string) =>
      setMessages((current) => current.map((message) => (message.id === replyId ? { ...message, text: message.text + text } : message)));
    // On failure the partial reply goes: Try again asks for a whole new one.
    const fail = (body: ChatErrorBody) => {
      setMessages(conversation);
      setError(failure(body));
    };

    let received = "";
    try {
      const turns: ChatTurn[] = conversation.map(({ from, text, files }) => ({ role: from, content: text, ...(files?.length && { attachments: files }) }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: option.provider, model: option.id, messages: fitAttachments(recentHistory(turns), limits.maxRequestBytes) }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        fail(((await response.json().catch(() => null)) as ChatErrorBody | null) ?? { code: "PROVIDER_ERROR" });
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        received += text;
        appendText(text);
      }
      if (!received.trim()) fail({ code: "PROVIDER_ERROR" });
    } catch (cause) {
      if (controller.signal.aborted) {
        // Stopped by the visitor: keep what arrived as the reply, or drop the empty bubble.
        if (!received.trim()) setMessages(conversation);
        return;
      }
      const code: ChatErrorCode = received ? "INTERRUPTED" : "NETWORK_ERROR";
      console.error("Chat request failed:", cause);
      fail({ code });
    } finally {
      abort.current = null;
      setStreaming(false);
    }
  }

  function send(text: string) {
    const problem = messageError(text, maxChars, pending.length);
    setDraftError(problem);
    if (problem) {
      composer.current?.focus();
      return;
    }
    // A message whose reply failed is replaced by the new one: turns must alternate.
    const base = messages.at(-1)?.from === "user" ? messages.slice(0, -1) : messages;
    const files = pending.map((file) => file.attachment);
    setDraft("");
    setPending([]);
    void reply([...base, { id: crypto.randomUUID(), from: "user", text: text.trim(), files, attachments: files.map(fileView) }]);
    composer.current?.focus();
  }

  /** Checks and reads picked, dropped or pasted files; the ones that can't be attached are explained. */
  async function addFiles(files: File[]) {
    const problems: string[] = [];
    const accepted = [...pending];
    for (const file of files) {
      if (accepted.length >= limits.maxFiles) {
        problems.push(`You can attach up to ${limits.maxFiles} files to a message.`);
        break;
      }
      const result = await readAttachment(file, limits);
      if ("error" in result) {
        problems.push(result.error);
        continue;
      }
      const together = totalAttachmentBytes([{ role: "user", content: "", attachments: [...accepted.map((p) => p.attachment), result.attachment] }]);
      if (together > limits.maxRequestBytes) {
        problems.push(`${file.name} doesn't fit: files can be up to ${formatBytes(limits.maxRequestBytes)} together.`);
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), attachment: result.attachment });
    }
    setPending(accepted);
    setDraftError(problems.length ? problems.join(" ") : undefined);
  }

  return (
    <ChatWindow
      assistantName={assistantName}
      greeting={greeting}
      suggestions={suggestions}
      onSuggestion={send}
      messages={messages}
      streaming={streaming}
      error={error?.message}
      onRetry={error?.retryable ? () => void reply(messages) : undefined}
      models={models}
      model={model}
      onModelChange={setModel}
      composerRef={composer}
      cvActions={cvActions(myData)}
      composer={{
        value: draft,
        onChange: (value) => {
          setDraft(value);
          if (draftError) setDraftError(undefined);
        },
        onSend: () => send(draft),
        onStop: () => abort.current?.abort(),
        maxChars,
        error: draftError,
        accept: ATTACHMENT_ACCEPT,
        onAddFiles: (files) => void addFiles(files),
        attachments: pending.map(({ id, attachment }) => ({ id, ...fileView(attachment) })),
        onRemoveFile: (id) => setPending((current) => current.filter((file) => file.id !== id)),
      }}
    />
  );
}
