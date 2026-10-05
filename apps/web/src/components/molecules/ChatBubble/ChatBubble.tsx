import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { FileChip, type FileChipProps } from "@/components/atoms/FileChip";
import { Icon } from "@/components/atoms/Icon";
import { Markdown, type MarkdownBlocks } from "@/components/atoms/Markdown";
import { Skeleton } from "@/components/atoms/Skeleton";
import { MatchReport } from "@/components/molecules/MatchReport";
import { ProfilePreview } from "@/components/molecules/ProfilePreview";
import { MATCH_BLOCK, parseMatchBlock, parseProfileBlock, PROFILE_BLOCK, type MatchBlock, type Profile } from "@/lib/chat";
import { cn } from "@/lib/cn";

const bubbleVariants = cva("max-w-[85%] rounded-card px-4 py-2.5 break-words shadow-bubble sm:max-w-[75%]", {
  variants: {
    // The visitor's messages on the right in brand green; the assistant's on the left in grey, with a
    // "tail" corner pointing at the sender, as in messaging apps.
    from: {
      // The visitor's text as typed (line breaks kept); the assistant's replies are Markdown.
      user: "rounded-br-control whitespace-pre-wrap bg-bubble-own text-on-bubble-own",
      assistant: "rounded-bl-control border border-border bg-surface-muted text-fg",
    },
  },
});

export type ChatBubbleProps = {
  from: "user" | "assistant";
  /** Who sent it, for screen readers ("You", or the assistant's name): the side and color only show it visually. */
  author: string;
  /** The message. An empty assistant message is a reply on its way: it shows a typing indicator. */
  children?: string;
  /** Files sent with the message, shown above its text. */
  attachments?: Pick<FileChipProps, "name" | "kind" | "detail" | "previewSrc">[];
  /** The reply is still arriving: an incomplete component block shows a placeholder, not an error. */
  streaming?: boolean;
  /** An earlier profile in the conversation (a newer one follows): its profile block shows collapsed. */
  collapseProfile?: boolean;
  className?: string;
};

/** How a component block shows: its parser, its component, and what to say while it streams or when it fails. */
type BlockSpec<T> = {
  parse: (code: string) => T | undefined;
  render: (value: T) => ReactNode;
  preparing: string;
  /** Usually a reply cut off by the length cap: the stream ends normally, so nothing else says so. */
  failed: string;
};

const MATCH: BlockSpec<MatchBlock> = {
  parse: parseMatchBlock,
  render: (report) => <MatchReport {...report} />,
  preparing: "Preparing match report…",
  failed: "This match report couldn't be shown. It may have been cut off: ask me to try again, or to check fewer requirements.",
};

const PROFILE: BlockSpec<Profile> = {
  parse: parseProfileBlock,
  render: (profile) => <ProfilePreview {...profile} />,
  preparing: "Preparing your profile…",
  failed: "This profile couldn't be shown. It may have been cut off: ask me to try again.",
};

/**
 * A reply's component block. Its JSON is judged by whether it parses: an open fence runs to the end
 * of the text, so a half-received block looks like a whole one.
 */
function BlockView<T>({ code, streaming, spec }: { code: string; streaming: boolean; spec: BlockSpec<T> }) {
  const value = spec.parse(code);
  if (value !== undefined) return spec.render(value);
  if (streaming) {
    return (
      <div role="status" className="my-2 space-y-2 rounded-card border border-border bg-surface p-4">
        <p className="text-sm text-fg-muted">{spec.preparing}</p>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }
  return <p className="my-2 rounded-control border border-border bg-surface px-3 py-2 text-sm">{spec.failed}</p>;
}

function blocks(streaming: boolean, collapseProfile: boolean): MarkdownBlocks {
  return {
    [MATCH_BLOCK]: (code) => <BlockView code={code} streaming={streaming} spec={MATCH} />,
    [PROFILE_BLOCK]: (code) =>
      collapseProfile ? (
        <details className="group my-2">
          {/* The browser's own marker differs per browser (Safari keeps it): hidden, a chevron instead. */}
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-control border border-border bg-surface px-3 text-sm font-semibold focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
            Earlier version of your profile
            <Icon name="chevron-down" className="size-4 group-open:rotate-180 motion-safe:transition-transform" />
          </summary>
          <BlockView code={code} streaming={streaming} spec={PROFILE} />
        </details>
      ) : (
        <BlockView code={code} streaming={streaming} spec={PROFILE} />
      ),
  };
}

// Module-level, so Markdown keeps reply blocks mounted while a reply streams in (a new object each
// render would remount them on every chunk). A bubble switches map once: when its reply ends, or when
// a newer profile collapses its own. A streaming reply is the newest, so it is never collapsed.
const BLOCKS = blocks(false, false);
const STREAMING_BLOCKS = blocks(true, false);
const COLLAPSED_BLOCKS = blocks(false, true);

/**
 * One chat message. The visitor's is plain text with its line breaks; the assistant's is Markdown
 * (lists, tables, code), with no raw HTML.
 */
export function ChatBubble({ from, author, children, attachments = [], streaming = false, collapseProfile = false, className }: ChatBubbleProps) {
  const typing = from === "assistant" && !children;
  return (
    <div className={cn("flex items-end gap-2", from === "user" && "justify-end", className)}>
      {from === "assistant" && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-brand text-fg-brand">
          <Icon name="sparkles" className="size-4" />
        </span>
      )}
      <div className={bubbleVariants({ from })}>
        <span className="sr-only">{author}: </span>
        {attachments.length > 0 && (
          <ul aria-label="Attached files" className={cn("flex flex-wrap gap-1.5 whitespace-normal", children && "mb-2")}>
            {attachments.map((file, index) => (
              // Names can repeat; the list never reorders.
              <li key={index} className="max-w-full">
                <FileChip {...file} />
              </li>
            ))}
          </ul>
        )}
        {typing ? (
          <span className="flex h-6 items-center gap-1">
            <span className="sr-only">typing</span>
            {/* Classes, not a style attribute: the CSP allows no inline styles. */}
            {["", "[animation-delay:150ms]", "[animation-delay:300ms]"].map((delay) => (
              <span key={delay} aria-hidden="true" className={cn("size-2 animate-bounce rounded-full bg-fg-muted motion-reduce:animate-none", delay)} />
            ))}
          </span>
        ) : from === "assistant" ? (
          <Markdown blocks={streaming ? STREAMING_BLOCKS : collapseProfile ? COLLAPSED_BLOCKS : BLOCKS}>{children ?? ""}</Markdown>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
