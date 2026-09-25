import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "../Spinner";

// Shape follows brighte.com.au's .cta; the green is deep enough for a white label to pass (see globals.scss).
/** Button styles, also for links that should look like buttons (e.g. a "Try again" link to reload). */
export const buttonVariants = cva(
  // 44px touch target, Brighte's 4px corners and 2px border; text-button (20-22px bold) is WCAG "large text" (AAA at 4.5:1).
  // Only colors animate, so the focus ring appears at once (apps/web/CLAUDE.md).
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border-2 px-7 py-1.5 text-button font-bold transition-[background-color,border-color] duration-150 focus-visible:focus-ring",
  {
    variants: {
      /** primary: the one main action on a screen. secondary: other actions. ghost: low-emphasis actions such as Retry. */
      variant: {
        primary: "border-action bg-action text-on-action hover:border-action-hover hover:bg-action-hover",
        // Brighte's outline CTA ("Login"), in the accessible green.
        secondary: "border-action bg-transparent text-fg-brand hover:bg-surface-brand",
        ghost: "border-transparent text-fg-brand hover:bg-surface-brand",
      },
      fullWidth: { true: "w-full" },
      /** Shows a spinner and blocks further clicks (prevents double submits). Change the label too, e.g. "Submitting…". */
      loading: {
        // Loading blocks clicks but keeps the button enabled and readable: only a real disabled state fades.
        true: "cursor-progress",
        false: "disabled:cursor-not-allowed disabled:opacity-60",
      },
    },
    defaultVariants: { variant: "primary", fullWidth: false, loading: false },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;
export type ButtonVariant = NonNullable<ButtonProps["variant"]>;

export function Button({ variant, fullWidth, loading = false, disabled, type = "button", className, children, onClick, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      // While loading: aria-disabled, not disabled. A disabled button loses keyboard focus (it drops to
      // the page), and it is usually the button that was just pressed. Clicks, including the implicit
      // one when Enter is pressed in a form field, are cancelled instead.
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={cn(buttonVariants({ variant, fullWidth, loading }), className)}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
