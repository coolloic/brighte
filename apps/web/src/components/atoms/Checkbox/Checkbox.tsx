import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  ref?: Ref<HTMLInputElement>;
};

/**
 * Native checkbox in a darker brand green. The box is 20px: wrap it in a <label> of at least 44px
 * (min-h-11) so the whole row is the touch target.
 */
export function Checkbox({ className, ...rest }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      // accent-control-checked, not the brand green: a checked box needs 3:1 against the page (WCAG 1.4.11).
      className={cn("size-5 shrink-0 cursor-pointer accent-control-checked focus-visible:focus-ring disabled:cursor-not-allowed", className)}
      {...rest}
    />
  );
}
