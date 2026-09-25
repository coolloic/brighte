import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

const headingVariants = cva("font-bold tracking-tight text-fg", {
  variants: {
    size: {
      xl: "text-3xl sm:text-4xl",
      lg: "text-2xl sm:text-3xl",
      md: "text-xl",
      sm: "text-lg",
    },
  },
});

type Level = 1 | 2 | 3 | 4;
const sizeForLevel = { 1: "xl", 2: "lg", 3: "md", 4: "sm" } as const;

export type HeadingProps = HTMLAttributes<HTMLHeadingElement> &
  VariantProps<typeof headingVariants> & {
    /** The heading level (h1-h4): keep them in order on a page, one h1. Use `size` to change only the look. */
    level: Level;
    /** e.g. to move focus to the heading after a form succeeds (with tabIndex={-1}). */
    ref?: Ref<HTMLHeadingElement>;
  };

export function Heading({ level, size, className, ...rest }: HeadingProps) {
  const Tag = `h${level}` as const;
  return <Tag className={cn(headingVariants({ size: size ?? sizeForLevel[level] }), className)} {...rest} />;
}
