"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { PdfPreviewDialog } from "@/components/molecules/PdfPreviewDialog";
import { cn } from "@/lib/cn";

export type CvButtonsProps = {
  onDownload: () => Promise<string | undefined>;
  onPreview: () => Promise<{ url: string } | { error: string }>;
  /** Shown as "Save profile" when given (the profile card). */
  onSave?: () => void;
  /** Why the PDF buttons are off, e.g. blocking flags on a tailored CV. */
  disabledReason?: string;
  className?: string;
};

/**
 * A CV card's file actions: preview and download the PDF (made on the server), and save the profile.
 * One request at a time; what's happening, or what went wrong, is announced politely.
 */
export function CvButtons({ onDownload, onPreview, onSave, disabledReason, className }: CvButtonsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<string>();
  /** On phones: the PDF's URL, offered as a link (a popup after the wait would be blocked). */
  const [phoneUrl, setPhoneUrl] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const statusId = useId();

  // The phone link's PDF is freed when a new one replaces it and when the card goes away.
  useEffect(
    () => () => {
      if (phoneUrl) URL.revokeObjectURL(phoneUrl);
    },
    [phoneUrl],
  );

  async function run(action: () => Promise<string | undefined>) {
    setBusy(true);
    setError(undefined);
    setPhoneUrl(undefined);
    try {
      setError(await action());
    } finally {
      setBusy(false);
    }
  }

  const download = () => run(onDownload);
  const showPreview = () =>
    run(async () => {
      const result = await onPreview();
      if ("error" in result) return result.error;
      // Wider screens: a dialog. Phones: a link to open it in the browser's own viewer. Opening a tab
      // here would be blocked: after the wait, it's no longer the tap that asked for it.
      if (window.matchMedia("(min-width: 640px)").matches) setPreview(result.url);
      else setPhoneUrl(result.url);
      return undefined;
    });

  const off = busy || Boolean(disabledReason);
  const status = busy ? "Preparing PDF…" : (error ?? disabledReason);
  return (
    <div ref={root} className={cn("mt-3 border-t border-border pt-3", className)}>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={showPreview} disabled={off} aria-describedby={statusId} data-cv-preview>
          Preview PDF
        </Button>
        <Button onClick={download} disabled={off} aria-busy={busy} aria-describedby={statusId}>
          Download PDF
        </Button>
        {onSave && (
          <Button variant="secondary" onClick={onSave}>
            Save profile
          </Button>
        )}
      </div>
      {/* Also the buttons' description: disabled buttons can't be focused, so this is how screen
          readers get the reason. */}
      <p id={statusId} role="status" className="mt-2 min-h-5 text-sm text-fg-muted">
        {status}
        {phoneUrl && !busy && (
          <a href={phoneUrl} target="_blank" rel="noopener" className="font-semibold text-fg-brand underline underline-offset-2 focus-visible:focus-ring">
            Open the PDF<span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </p>
      {preview && (
        <PdfPreviewDialog
          url={preview}
          onClose={() => {
            URL.revokeObjectURL(preview);
            setPreview(undefined);
            // Back to Preview PDF: it was disabled while the PDF loaded, so the browser had moved focus away.
            root.current?.querySelector<HTMLButtonElement>("[data-cv-preview]")?.focus();
          }}
        />
      )}
    </div>
  );
}
