"use client";

import { useRef, useState } from "react";
import { ChatWindow, type ChatMessage } from "@/components/organisms/ChatWindow";
import { chatErrorMessage, messageError, recentHistory, type ChatErrorBody, type ChatErrorCode } from "@/lib/chat";
import { modelKey, type ChatTurn, type ModelOption } from "@/lib/llm";

export type ChatProps = {
  assistantName: string;
  greeting: string;
  suggestions: string[];
  models: ModelOption[];
  defaultModel: string;
  maxChars: number;
};

type Failure = { message: string; retryable: boolean };

const failure = (body: ChatErrorBody): Failure => ({ message: chatErrorMessage(body), retryable: body.code !== "RATE_LIMITED" });

/**
 * The chat page's state: the conversation (in this tab only), the picked model, and one streaming
 * reply at a time. Sends the recent history to /api/chat and shows the reply as it arrives.
 */
export function Chat({ assistantName, greeting, suggestions, models, defaultModel, maxChars }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string>();
  const [model, setModel] = useState(defaultModel);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<Failure>();
  const abort = useRef<AbortController>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  /** Streams the assistant's reply to `conversation` (which ends with the visitor's message). */
  async function reply(conversation: ChatMessage[]) {
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
      const turns: ChatTurn[] = conversation.map(({ from, text }) => ({ role: from, content: text }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: option.provider, model: option.id, messages: recentHistory(turns) }),
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
    const problem = messageError(text, maxChars);
    setDraftError(problem);
    if (problem) {
      composer.current?.focus();
      return;
    }
    // A message whose reply failed is replaced by the new one: turns must alternate.
    const base = messages.at(-1)?.from === "user" ? messages.slice(0, -1) : messages;
    setDraft("");
    void reply([...base, { id: crypto.randomUUID(), from: "user", text: text.trim() }]);
    composer.current?.focus();
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
      }}
    />
  );
}
