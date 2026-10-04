import { cva } from "class-variance-authority";
import { FileChip, type FileChipProps } from "@/components/atoms/FileChip";
import { Icon } from "@/components/atoms/Icon";
import { Markdown } from "@/components/atoms/Markdown";
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
  className?: string;
};

/**
 * One chat message. The visitor's is plain text with its line breaks; the assistant's is Markdown
 * (lists, tables, code), with no raw HTML.
 */
export function ChatBubble({ from, author, children, attachments = [], className }: ChatBubbleProps) {
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
          <Markdown>{children ?? ""}</Markdown>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
