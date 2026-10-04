import type { ReactNode, Ref } from "react";
import { Button } from "@/components/atoms/Button";
import { FieldError } from "@/components/atoms/FieldError";
import { Icon } from "@/components/atoms/Icon";
import { cn } from "@/lib/cn";

export type ChatComposerProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** Shown while a reply streams: replaces Send with Stop. */
  onStop?: () => void;
  streaming?: boolean;
  maxChars: number;
  /** Why the message can't be sent (e.g. too long). */
  error?: string;
  /** Small controls on the right of the hint line, e.g. the model picker. */
  toolbar?: ReactNode;
  ref?: Ref<HTMLTextAreaElement>;
};

/**
 * Send/Stop: as tall as a one-line message box (one line of body text, 2 x 10px padding, 2 x 1px
 * border; 46px on phones up to about 49px on desktop, as the text grows) and square. Set from the
 * line height rather than stretched, so it keeps that size when the box grows to several lines.
 */
const actionButton = "aspect-square h-[calc(1lh+1.25rem+2px)] min-h-11 shrink-0 px-0 py-0 text-body";

/**
 * Message box and Send button, as in messaging apps: Enter sends, Shift+Enter adds a line, and the
 * box grows with the text (where the browser supports field-sizing). A character count appears near
 * the limit. While a reply streams, typing stays possible and Send becomes Stop.
 */
export function ChatComposer({ id, value, onChange, onSend, onStop, streaming = false, maxChars, error, toolbar, ref }: ChatComposerProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  const length = value.trim().length;
  const showCount = length > maxChars * 0.8;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!streaming) onSend();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Message
      </label>
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          id={id}
          name="message"
          rows={1}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error && errorId, showCount && countId, hintId].filter(Boolean).join(" ")}
          placeholder="Type a message"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, unless Shift is held or an input method (e.g. Chinese, Japanese) is composing text.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className={cn(
            // Styled like Input: 44px tall, 16px text, 3:1 border, green focus edge.
            "block max-h-40 min-h-11 w-full resize-none rounded-control border border-border-strong bg-surface px-3 py-2.5 text-body text-fg field-sizing-content",
            "placeholder:text-fg-muted focus-visible:border-focus focus-visible:outline-1 focus-visible:outline-focus",
            "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger",
          )}
        />
        {streaming ? (
          <Button variant="secondary" onClick={onStop} aria-label="Stop the reply" className={actionButton}>
            <Icon name="stop" />
          </Button>
        ) : (
          <Button type="submit" aria-label="Send message" className={actionButton}>
            <Icon name="send" />
          </Button>
        )}
      </div>
      <div className="mt-1 flex min-h-6 flex-wrap items-center justify-between gap-x-4 text-sm text-fg-muted">
        <p id={hintId}>
          Enter to send<span className="hidden sm:inline">, Shift+Enter for a new line</span>
        </p>
        <div className="ml-auto flex items-center gap-3">
          {showCount && (
            <p id={countId} className={cn("shrink-0 tabular-nums", length > maxChars && "text-danger")}>
              {length}/{maxChars}
              <span className="sr-only"> characters</span>
            </p>
          )}
          {toolbar}
        </div>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </form>
  );
}
