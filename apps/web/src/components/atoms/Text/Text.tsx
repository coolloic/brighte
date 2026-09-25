import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const textVariants = cva("", {
  variants: {
    // base: body copy, 16px on mobile (never smaller) to 18px. lg: intro under a page title, 18px to 20px.
    // sm: secondary details, fixed 14px.
    size: { sm: "text-sm", base: "text-body", lg: "text-lead" },
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
