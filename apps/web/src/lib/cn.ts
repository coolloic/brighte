import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge recognises our color tokens by itself, but not custom radius and shadow names:
// without this, `cn("rounded-control", "rounded-card")` would keep both and the override would lose.
// Keep in step with --radius-* and --shadow-* in globals.scss (cn.test.ts checks this).
export const CUSTOM_RADIUS = ["control", "card"];
export const CUSTOM_SHADOW = ["card"];

const twMerge = extendTailwindMerge({
  extend: { theme: { radius: CUSTOM_RADIUS, shadow: CUSTOM_SHADOW } },
});

/** Joins class names (strings, arrays, conditionals) and lets later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
