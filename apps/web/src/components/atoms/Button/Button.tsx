import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "../Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: the one main action on a screen. secondary: other actions. ghost: low-emphasis actions such as Retry. */
  variant?: ButtonVariant;
  /** Shows a spinner and blocks further clicks (prevents double submits). Change the label too, e.g. "Submitting…". */
  loading?: boolean;
  fullWidth?: boolean;
};

// Follows brighte.com.au's .cta: 4px corners, 2px border, white bold label. The green is a deeper brand
// shade so text passes: the 20px bold label is WCAG "large text", AAA at 4.5:1 (white on it: 4.95:1).
const variants: Record<ButtonVariant, string> = {
  primary: "border-action bg-action text-on-action hover:border-action-hover hover:bg-action-hover",
  // Brighte's outline CTA ("Login"), in the same accessible green (their #00c28c text is 2.31:1).
  secondary: "border-action bg-transparent text-fg-brand hover:bg-surface-brand",
  ghost: "border-transparent text-fg-brand hover:bg-surface-brand",
};

export function Button({
  variant = "primary",
  loading = false,
  fullWidth = false,
  disabled,
  type = "button",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border-2 px-7 py-1.5 text-xl font-bold",
        // Only the background animates: the focus ring must appear at once (see apps/web/CLAUDE.md).
        "transition-[background-color,border-color] duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        // Loading also disables the button, but "Submitting…" must stay readable: only a real disabled state fades.
        loading ? "cursor-progress" : "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
