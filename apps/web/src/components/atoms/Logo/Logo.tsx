import type { SVGAttributes } from "react";
import { cn } from "@/lib/cn";

export type LogoProps = SVGAttributes<SVGSVGElement>;

/**
 * CV coach mark: a page with text lines and a spark, shown beside the "CV coach" wordmark. Painted
 * with `currentColor` (text-logo by default, the brand green). Decorative: the text next to it gives
 * the name. 28px on mobile, 36px from md.
 */
export function Logo({ className, ...rest }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("size-7 shrink-0 text-logo md:size-9", className)}
      {...rest}
    >
      <path d="M19 3H8a3 3 0 0 0-3 3v20a3 3 0 0 0 3 3h11" />
      <path d="M10 11h8M10 16h6M10 21h5" />
      <path d="M25 14l1.4 3.6L30 19l-3.6 1.4L25 24l-1.4-3.6L20 19l3.6-1.4z" fill="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
