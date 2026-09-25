import { cn } from "@/lib/cn";

export type SpinnerProps = {
  /** Announced to screen readers. Omit when nearby text already says what is loading (e.g. inside a button). */
  label?: string;
  className?: string;
};

/** Loading indicator. Uses the current text color; stops spinning when the user prefers reduced motion. */
export function Spinner({ label, className }: SpinnerProps) {
  const icon = (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={cn("size-5 shrink-0 animate-spin motion-reduce:animate-none", className)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (!label) return icon;
  return (
    <span role="status" className="inline-flex items-center">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}
