import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

export type MarkdownProps = {
  /** Markdown text, e.g. a model's reply. It may be incomplete while it streams in. */
  children: string;
  className?: string;
};

const heading = "mt-3 mb-1 font-semibold first:mt-0";
const link = "text-fg-brand underline underline-offset-2 focus-visible:focus-ring";

// Elements styled with Tailwind (no typography plugin). Headings start at <h3>: the page has its <h1>
// and the chat its <h2>, so a reply's "# Summary" keeps the heading order. The top level is a size
// up (lead text); the rest are bold body text. Code wraps its long lines.
const components: Components = {
  h1: ({ children }) => <h3 className={cn(heading, "text-lead")}>{children}</h3>,
  h2: ({ children }) => <h4 className={heading}>{children}</h4>,
  h3: ({ children }) => <h5 className={heading}>{children}</h5>,
  h4: ({ children }) => <h6 className={heading}>{children}</h6>,
  h5: ({ children }) => <h6 className={heading}>{children}</h6>,
  h6: ({ children }) => <h6 className={heading}>{children}</h6>,
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ul>,
  ol: ({ children, start }) => (
    <ol start={start} className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  blockquote: ({ children }) => <blockquote className="my-2 border-l-4 border-border-strong pl-3">{children}</blockquote>,
  hr: () => <hr className="my-3 border-border" />,
  // Inline code; inside <pre> the block's own box replaces the chip look.
  code: ({ children }) => <code className="rounded-control bg-surface px-1 font-mono text-sm in-[pre]:bg-transparent in-[pre]:p-0">{children}</code>,
  pre: ({ children }) => <pre className="my-2 rounded-control border border-border bg-surface p-3 font-mono text-sm break-words whitespace-pre-wrap">{children}</pre>,
  // A table too wide for the bubble scrolls sideways in its own box (focusable, so keyboards can
  // scroll it too) rather than breaking words mid-way.
  table: ({ children }) => (
    <div role="region" aria-label="Table" tabIndex={0} className="my-2 overflow-x-auto rounded-control focus-visible:focus-ring">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  // `style` carries a column's alignment (`|:--|`).
  th: ({ children, style }) => (
    <th style={style} className="border border-border bg-surface px-2 py-1 text-left align-top font-semibold">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="border border-border px-2 py-1 align-top">
      {children}
    </td>
  ),
  // Links come from the model, so they open in a new tab and pass no referrer.
  a: ({ children, href, title }) => (
    <a className={link} href={href} title={title} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ),
  // No images from the model: they would load from any host (tracking) and the CSP blocks them anyway.
  // Show the alt text as a link instead.
  img: ({ src, alt }) =>
    typeof src === "string" && src ? (
      <a className={link} href={src} target="_blank" rel="noopener noreferrer">
        {alt || src}
        <span className="sr-only"> (image, opens in a new tab)</span>
      </a>
    ) : (
      alt
    ),
};

/**
 * Markdown as safe HTML: GitHub-flavoured (tables, task lists, strikethrough), no raw HTML (it is
 * shown as text), and react-markdown drops unsafe link protocols such as `javascript:`.
 */
export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn("break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
