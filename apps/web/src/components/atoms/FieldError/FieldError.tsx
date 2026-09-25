import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../Icon";

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
export function FieldError({ id, children, className }: FieldErrorProps) {
  return (
    <p
      id={id}
      className={cn(
        // Brighte's inline error box: tinted, red border, 4px corners, just below the field.
        "mt-1.5 flex items-start gap-1.5 rounded-control border border-danger bg-danger-surface px-2 py-1.5 text-sm text-danger",
        className,
      )}
    >
      <Icon name="alert-circle" className="mt-0.5 size-4" />
      <span>{children}</span>
    </p>
  );
}
