"use client";

import { useEffect, useRef, type Ref } from "react";
import { Button } from "@/components/atoms/Button";
import { Heading } from "@/components/atoms/Heading";
import { Icon } from "@/components/atoms/Icon";
import { Alert } from "@/components/molecules/Alert";
import { ChatBubble, type ChatBubbleProps } from "@/components/molecules/ChatBubble";
import { ChatComposer, type ChatComposerProps } from "@/components/molecules/ChatComposer";
import { ModelPicker } from "@/components/molecules/ModelPicker";
import { hasBlock, PROFILE_BLOCK } from "@/lib/chat";
import type { ModelOption } from "@/lib/llm";

export type ChatMessage = { id: string; from: "user" | "assistant"; text: string; attachments?: ChatBubbleProps["attachments"] };

export type ChatWindowProps = {
  assistantName: string;
  /** The assistant's first message, shown in every chat (not sent to the model). */
  greeting: string;
  /** Example questions, as buttons, until the visitor sends something. */
  suggestions?: string[];
  onSuggestion: (text: string) => void;
  messages: ChatMessage[];
  /** A reply is streaming in: the log is busy (screen readers announce it once complete). */
  streaming?: boolean;
  /** Why the last message failed, with an optional Try again. */
  error?: string;
  onRetry?: () => void;
  models: ModelOption[];
  model: string;
  onModelChange: (key: string) => void;
  composer: Omit<ChatComposerProps, "id" | "streaming" | "ref" | "toolbar">;
  composerRef?: Ref<HTMLTextAreaElement>;
};

/** How close to the bottom (px) still counts as reading the latest message, so new text scrolls into view. */
const FOLLOW_THRESHOLD = 160;

/**
 * A messaging-app style chat: header with the assistant, the conversation (newest at the bottom),
 * and the message box, which sticks to the bottom of the screen. The model picker is a compact
 * button under the message box, usable at any time (it applies to the next message).
 * Presentational: the page holds the conversation and talks to the server.
 */
export function ChatWindow({
  assistantName,
  greeting,
  suggestions = [],
  onSuggestion,
  messages,
  streaming = false,
  error,
  onRetry,
  models,
  model,
  onModelChange,
  composer,
  composerRef,
}: ChatWindowProps) {
  const messageCount = useRef(messages.length);
  const latest = messages.at(-1);
  // Corrections give new profiles: only the newest stays open, earlier ones collapse.
  const latestProfileId = messages.findLast((message) => message.from === "assistant" && hasBlock(message.text, PROFILE_BLOCK))?.id;

  // Follow the conversation (the page scrolls, the composer sticks to the bottom): a new message
  // always scrolls into view; a growing reply does only while the visitor is reading at the bottom,
  // not when they scrolled up to read something earlier.
  useEffect(() => {
    const page = document.scrollingElement;
    if (!page) return;
    const added = messages.length > messageCount.current;
    messageCount.current = messages.length;
    if (added || page.scrollHeight - page.scrollTop - page.clientHeight < FOLLOW_THRESHOLD) page.scrollTop = page.scrollHeight;
  }, [messages.length, latest?.text, error]);

  return (
    <section aria-labelledby="chat-title" className="flex min-h-112 flex-col rounded-card border border-border bg-surface shadow-card">
      <header className="flex items-center gap-3 border-b border-border p-4">
        <span className="flex size-10 items-center justify-center rounded-full bg-surface-brand text-fg-brand">
          <Icon name="sparkles" />
        </span>
        <Heading level={2} size="sm" id="chat-title">
          {assistantName}
        </Heading>
      </header>

      <div role="log" aria-label="Conversation" aria-busy={streaming} className="flex-1 space-y-3 p-4">
        <ChatBubble from="assistant" author={assistantName}>
          {greeting}
        </ChatBubble>
        {messages.length === 0 && suggestions.length > 0 && (
          <ul aria-label="Suggested questions" className="flex flex-wrap gap-2 pl-10">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => onSuggestion(suggestion)}
                  className="min-h-11 cursor-pointer rounded-full border border-action px-4 py-2 text-sm text-fg-brand transition-[background-color] hover:bg-surface-brand focus-visible:focus-ring"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        )}
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            from={message.from}
            author={message.from === "user" ? "You" : assistantName}
            attachments={message.attachments}
            streaming={streaming && message === latest && message.from === "assistant"}
            collapseProfile={message.from === "assistant" && message.id !== latestProfileId && hasBlock(message.text, PROFILE_BLOCK)}
          >
            {message.text}
          </ChatBubble>
        ))}
      </div>

      {/* Stays at the bottom of the screen while the conversation scrolls, clear of the phone's home bar. */}
      <div className="sticky bottom-0 space-y-3 rounded-b-card border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && (
          <Alert
            tone="error"
            title={error}
            action={
              onRetry && (
                <Button variant="secondary" onClick={onRetry}>
                  Try again
                </Button>
              )
            }
          />
        )}
        <ChatComposer
          id="chat-message"
          ref={composerRef}
          streaming={streaming}
          // Applies to the next message, so it stays usable while a reply streams.
          toolbar={<ModelPicker id="chat-model" options={models} value={model} onChange={onModelChange} />}
          {...composer}
        />
      </div>
    </section>
  );
}
