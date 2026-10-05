"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/atoms/Button";

export type PdfPreviewDialogProps = { url: string; onClose: () => void };

/** The CV's PDF in a modal dialog. Escape or Close closes it; the owner puts focus back (onClose). */
export function PdfPreviewDialog({ url, onClose }: PdfPreviewDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto h-[90vh] w-[min(56rem,92vw)] rounded-card border border-border bg-surface p-0 shadow-popover backdrop:bg-fg/50"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 id={titleId} className="font-semibold">
            CV preview
          </h2>
          <Button variant="secondary" onClick={() => dialog.current?.close()}>
            Close
          </Button>
        </div>
        <iframe src={url} title="CV preview" className="w-full flex-1" />
      </div>
    </dialog>
  );
}
