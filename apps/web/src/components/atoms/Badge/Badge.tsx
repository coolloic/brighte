import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// Pill, like Brighte's "Official launch finance provider" badge. Text is WCAG AAA on each tint.
const badgeVariants = cva("inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold", {
  variants: {
    tone: {
      brand: "bg-surface-brand text-fg-brand",
      neutral: "bg-surface-muted text-fg",
    },
  },
  defaultVariants: { tone: "brand" },
});

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

/** A short label, e.g. a service a lead is interested in. Not interactive. */
export function Badge({ tone, className, ...rest }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...rest} />;
}
