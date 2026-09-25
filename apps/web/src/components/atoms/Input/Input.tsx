import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Marks the value as invalid (aria-invalid) and turns the border red. Pair it with a FieldError: color alone is not enough. */
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
};

/**
 * Single-line text input, styled after Brighte's support form (1px border, 4px corners, 10px padding;
 * focus turns the border green). Stronger than Brighte's where WCAG needs it: the border is 3:1
 * (theirs is #ddd, 1.4:1), focus adds a 1px outline so the green edge is 2px, and text is 16px in a
 * 44px field. Always give it a <Label htmlFor>.
 */
export function Input({ invalid = false, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        // Field: 44px tall, 16px text (stops iOS zooming), Brighte's 1px border and 4px corners.
        "block min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 py-2.5 text-base text-fg",
        "placeholder:text-fg-muted",
        // Focus: the border turns green and a 1px outline makes the edge 2px.
        "focus-visible:border-focus focus-visible:outline-1 focus-visible:outline-focus",
        // Invalid (shown with a FieldError): red border and focus outline.
        "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger",
        "disabled:cursor-not-allowed disabled:bg-surface-muted",
        className,
      )}
      {...rest}
    />
  );
}
