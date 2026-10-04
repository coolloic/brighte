import { cn } from "@/lib/cn";
import { Icon } from "../Icon";

export type FileChipProps = {
  name: string;
  kind: "image" | "pdf" | "text";
  /** e.g. the size, "1.2 MB". */
  detail?: string;
  /** A thumbnail for images (a data: URL). */
  previewSrc?: string;
  /** Shows a remove button (44px), named "Remove <name>". */
  onRemove?: () => void;
  className?: string;
};

/**
 * An attached file: a thumbnail (images) or file icon, its name and an optional detail such as its
 * size. A long name is cut to one line (the whole name is in the title, and read by screen readers).
 */
export function FileChip({ name, kind, detail, previewSrc, onRemove, className }: FileChipProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-2 rounded-control border border-border bg-surface py-1 pl-1.5 text-sm text-fg",
        onRemove ? "min-h-11 pr-0" : "pr-2.5",
        className,
      )}
    >
      {previewSrc && kind === "image" ? (
        // Decorative: the name says what it is. A data: URL, so next/image doesn't apply.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewSrc} alt="" className="size-8 shrink-0 rounded-sm object-cover" />
      ) : (
        <Icon name="file" className="size-5 shrink-0 text-fg-muted" />
      )}
      <span className="min-w-0 truncate" title={name}>
        {name}
      </span>
      {detail && <span className="shrink-0 text-fg-muted">{detail}</span>}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-fg-muted transition-[background-color] hover:bg-surface-muted hover:text-fg focus-visible:focus-ring"
        >
          <Icon name="x" className="size-4" />
        </button>
      )}
    </span>
  );
}
