import type { ReactNode } from "react";

export type FieldErrorProps = {
  /** Referenced by the input's aria-describedby, so screen readers read the error with the field. */
  id: string;
  children: ReactNode;
  className?: string;
};

/**
 * Error message shown below a field, styled after Brighte's support form: a tinted box with a red
 * border and a circled "!". The icon and the text, not just the color, say something is wrong.
 */
export function FieldError({ id, children, className = "" }: FieldErrorProps) {
  return (
    <p
      id={id}
      className={`mt-1.5 flex items-start gap-1.5 rounded-control border border-danger bg-danger-surface px-2 py-1.5 text-sm text-danger ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5v4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.25" r="0.9" fill="currentColor" />
      </svg>
      <span>{children}</span>
    </p>
  );
}
