import { cn } from "@/lib/cn";

export type SkeletonProps = {
  /** Size and shape, e.g. "h-4 w-40" or "h-24 w-full rounded-card". */
  className?: string;
};

/**
 * Grey placeholder while content loads. Hidden from screen readers: mark the loading region with
 * aria-busy and give it a visually hidden "Loading…" instead. Stops pulsing for reduced motion.
 */
export function Skeleton({ className }: SkeletonProps) {
  // bg-border, not surface-muted: surface-muted is nearly invisible on white.
  return <div aria-hidden="true" className={cn("animate-pulse rounded-control bg-border motion-reduce:animate-none", className)} />;
}
