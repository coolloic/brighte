import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const textVariants = cva("", {
  variants: {
    // base (16px) is the smallest size for body copy on mobile; sm is for secondary details.
    size: { sm: "text-sm", base: "text-base", lg: "text-lg" },
    // Both tones are WCAG AAA on white.
    tone: { default: "text-fg", muted: "text-fg-muted" },
  },
  defaultVariants: { size: "base", tone: "default" },
});

export type TextProps = HTMLAttributes<HTMLElement> &
  VariantProps<typeof textVariants> & {
    as?: "p" | "span" | "div";
  };

export function Text({ as: Tag = "p", size, tone, className, ...rest }: TextProps) {
  return <Tag className={cn(textVariants({ size, tone }), className)} {...rest} />;
}
