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
  /** Shown as "Save to my data" when given ("My data" is on): what to say when it worked, or an error. */
  onSaveToMyData?: () => Promise<{ saved: string } | { error: string }>;
  /** Why the PDF buttons are off, e.g. blocking flags on a tailored CV. */
  disabledReason?: string;
  /** Download once as soon as this is true (the chat's pdf export tool), unless the buttons are off. */
  autoDownload?: boolean;
  className?: string;
};

/**
 * A CV card's file actions: preview and download the PDF (made on the server), save the profile, and
 * save the card to "My data". One request at a time; what's happening, or what went wrong, is
 * announced politely.
 */
export function CvButtons({ onDownload, onPreview, onSave, onSaveToMyData, disabledReason, autoDownload = false, className }: CvButtonsProps) {
  const [busy, setBusy] = useState<"pdf" | "my-data">();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
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

  async function run(action: () => Promise<string | undefined>, kind: "pdf" | "my-data" = "pdf") {
    setBusy(kind);
    setError(undefined);
    setSaved(undefined);
    setPhoneUrl(undefined);
    try {
      setError(await action());
    } finally {
      setBusy(undefined);
    }
  }

  const saveToMyData = () =>
    onSaveToMyData &&
    run(async () => {
      const result = await onSaveToMyData();
      if ("error" in result) return result.error;
      setSaved(result.saved);
      return undefined;
    }, "my-data");

  const download = () => run(onDownload);

  // Asked for in the chat: download once, as if Download PDF had been pressed.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoDownload || disabledReason || autoStarted.current) return;
    autoStarted.current = true;
    void download();
  });
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

  const off = Boolean(busy) || Boolean(disabledReason);
  const status = busy === "pdf" ? "Preparing PDF…" : busy === "my-data" ? "Saving…" : (error ?? saved ?? disabledReason);
  return (
    <div ref={root} className={cn("mt-3 border-t border-border pt-3", className)}>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={showPreview} disabled={off} aria-describedby={statusId} data-cv-preview>
          Preview PDF
        </Button>
        <Button onClick={download} disabled={off} aria-busy={busy === "pdf"} aria-describedby={statusId}>
          Download PDF
        </Button>
        {onSave && (
          <Button variant="secondary" onClick={onSave}>
            Save profile
          </Button>
        )}
        {onSaveToMyData && (
          <Button variant="secondary" onClick={() => void saveToMyData()} disabled={off} aria-busy={busy === "my-data"} aria-describedby={statusId}>
            Save to my data
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
