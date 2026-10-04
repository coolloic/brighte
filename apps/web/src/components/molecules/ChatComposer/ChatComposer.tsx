"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Button } from "@/components/atoms/Button";
import { FieldError } from "@/components/atoms/FieldError";
import { FileChip, type FileChipProps } from "@/components/atoms/FileChip";
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
  /**
   * Attaching files: the attach button, dropping files on the box, and pasting them. Without
   * onAddFiles, none of this shows.
   */
  onAddFiles?: (files: File[]) => void;
  /** For the file picker, e.g. "image/png,application/pdf,.txt". */
  accept?: string;
  /** Files attached to the next message, as removable chips. */
  attachments?: (Omit<FileChipProps, "onRemove" | "className"> & { id: string })[];
  onRemoveFile?: (id: string) => void;
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
 * the limit. While a reply streams, typing stays possible and Send becomes Stop. Files can be
 * attached with the paperclip button, by dropping them on the box, or by pasting them; they show as
 * removable chips above it. The error line (too long, a file that can't be attached) is announced.
 */
export function ChatComposer({
  id,
  value,
  onChange,
  onSend,
  onStop,
  streaming = false,
  maxChars,
  error,
  toolbar,
  onAddFiles,
  accept,
  attachments = [],
  onRemoveFile,
  ref,
}: ChatComposerProps) {
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);

  // Drop files anywhere on the composer. Mouse-only by nature, so these are plain listeners rather
  // than JSX props on the form: the attach button is the accessible way to add files.
  const addFiles = useRef(onAddFiles);
  useEffect(() => {
    addFiles.current = onAddFiles;
  });
  const canAttach = Boolean(onAddFiles);
  useEffect(() => {
    const target = form.current;
    if (!target || !canAttach) return;
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDropping(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (!target.contains(event.relatedTarget as Node | null)) setDropping(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDropping(false);
      addFiles.current?.([...(event.dataTransfer?.files ?? [])]);
    };
    target.addEventListener("dragover", onDragOver);
    target.addEventListener("dragleave", onDragLeave);
    target.addEventListener("drop", onDrop);
    return () => {
      target.removeEventListener("dragover", onDragOver);
      target.removeEventListener("dragleave", onDragLeave);
      target.removeEventListener("drop", onDrop);
    };
  }, [canAttach]);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  const length = value.trim().length;
  const showCount = length > maxChars * 0.8;

  return (
    <form
      ref={form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!streaming) onSend();
      }}
    >
      {attachments.length > 0 && (
        <ul aria-label="Attached files" className="mb-2 flex flex-wrap gap-2">
          {attachments.map(({ id: fileId, ...file }) => (
            <li key={fileId} className="max-w-full">
              <FileChip {...file} onRemove={onRemoveFile && (() => onRemoveFile(fileId))} />
            </li>
          ))}
        </ul>
      )}
      <label htmlFor={id} className="sr-only">
        Message
      </label>
      <div className={cn("flex items-end gap-2 rounded-control", dropping && "outline-2 outline-offset-4 outline-focus outline-dashed")}>
        {onAddFiles && (
          <>
            <Button variant="ghost" aria-label="Attach files" onClick={() => fileInput.current?.click()} className={actionButton}>
              <Icon name="paperclip" />
            </Button>
            {/* Opened by the button above; hidden, so it is not a second tab stop. */}
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={accept}
              hidden
              aria-label="Attach files"
              onChange={(event) => {
                if (event.target.files?.length) onAddFiles([...event.target.files]);
                // The same file can be picked again after removing it.
                event.target.value = "";
              }}
            />
          </>
        )}
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
          onPaste={(event) => {
            // Pasted files (e.g. a screenshot) are attached; pasted text goes in as usual.
            if (!onAddFiles || event.clipboardData.files.length === 0) return;
            event.preventDefault();
            onAddFiles([...event.clipboardData.files]);
          }}
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
      {/* Announced when it appears: a file can be refused without focus being in the box. */}
      <div aria-live="polite">{error && <FieldError id={errorId}>{error}</FieldError>}</div>
    </form>
  );
}
