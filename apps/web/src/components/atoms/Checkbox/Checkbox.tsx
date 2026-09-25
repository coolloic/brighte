import type { InputHTMLAttributes, Ref } from "react";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  ref?: Ref<HTMLInputElement>;
};

/**
 * Native checkbox in a darker brand green. The box is 20px: wrap it in a <label> of at least 44px
 * (min-h-11) so the whole row is the touch target.
 */
export function Checkbox({ className = "", ...rest }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={[
        // Not bg-action green: a checked box needs 3:1 against the page (WCAG 1.4.11).
        "size-5 shrink-0 cursor-pointer accent-control-checked",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:cursor-not-allowed",
        className,
      ].join(" ")}
      {...rest}
    />
  );
}
