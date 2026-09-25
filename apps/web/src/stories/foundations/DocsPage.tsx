import type { ReactNode } from "react";

export type Announce = (message: string) => void;

/** Copies `text` and reports the result through `announce` (a role="status" line reads it out). */
export function CopyButton({ text, kind, announce }: { text: string; kind: string; announce: Announce }) {
  const copy = () => {
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    (clipboard ? clipboard.writeText(text) : Promise.reject(new Error("Clipboard unavailable"))).then(
      () => announce(`Copied ${text}`),
      () => announce(`Couldn't copy ${text}. Select it and copy it manually.`),
    );
  };
  return (
    <button
      type="button"
      aria-label={`Copy ${kind} ${text}`}
      onClick={copy}
      className="min-h-11 w-full cursor-pointer rounded-control border border-border bg-surface px-3 py-2 text-left font-mono text-sm break-words text-fg transition-[background-color] duration-150 hover:bg-surface-muted focus-visible:focus-ring"
    >
      {text}
    </button>
  );
}

/** Layout for Foundations pages: title, intro, and a sticky status line that announces copy results. */
export function DocsPage({
  title,
  intro,
  status,
  hint = "Click a token to copy it.",
  children,
}: {
  title: string;
  intro: ReactNode;
  status: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-fg sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-2 max-w-3xl text-fg-muted">{intro}</div>
      <p role="status" className="sticky top-0 z-10 mt-4 min-h-11 rounded-control bg-surface-brand px-4 py-3 text-sm text-fg shadow-card">
        {status || hint}
      </p>
      {children}
    </main>
  );
}
