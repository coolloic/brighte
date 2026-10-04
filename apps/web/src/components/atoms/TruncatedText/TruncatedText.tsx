"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TruncatedTextProps = {
  /** The text, e.g. a name, or <EmailAddress /> (shown again in the popover). */
  children: ReactNode;
  className?: string;
};

/** True when the 3 lines cut text off. */
const isCutOff = (el: HTMLElement | null) => el !== null && el.scrollHeight > el.clientHeight + 1;

/**
 * Long text shown on at most 3 lines, cut off with "…". When it is cut off, a popover shows all of
 * it: on hover (it stays while the pointer moves onto it, so the text can be selected), on tap, and
 * when the link around it gets keyboard focus. Escape closes it (WCAG 1.4.13).
 *
 * Screen readers always get the whole text (the clamp is visual only), so the popover is
 * aria-hidden: they would otherwise hear it twice. It sits above a row's stretched link
 * (`relative z-10`) to receive the pointer; inside a link, clicking it still follows the link.
 */
export function TruncatedText({ children, className }: TruncatedTextProps) {
  const root = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  // Only when the 3 lines cut something off.
  const show = () => {
    if (isCutOff(text.current)) setOpen(true);
  };
  const hide = () => setOpen(false);

  // Keyboard focus lands on the link around the text (a row's name), not on the text itself.
  useEffect(() => {
    const link = root.current?.closest("a");
    if (!link) return;
    const onFocus = () => {
      if (link.matches(":focus-visible") && isCutOff(text.current)) setOpen(true);
    };
    const onBlur = () => setOpen(false);
    link.addEventListener("focus", onFocus);
    link.addEventListener("blur", onBlur);
    return () => {
      link.removeEventListener("focus", onFocus);
      link.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <span ref={root} onPointerEnter={show} onPointerLeave={hide} className={cn("relative z-10 block", className)}>
      <span ref={text} className="line-clamp-3 wrap-anywhere">
        {children}
      </span>
      {/* pt-1 instead of a margin: the pointer crosses no gap on its way to the popover, so it stays open. */}
      <span aria-hidden="true" hidden={!open} className="absolute top-full left-0 z-20 pt-1">
        <span className="block w-max max-w-[min(24rem,calc(100vw-2rem))] rounded-control bg-surface-inverse px-3 py-2 text-sm font-normal text-fg-inverse shadow-card wrap-anywhere">
          {children}
        </span>
      </span>
    </span>
  );
}
