import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge recognises our color tokens by itself, but not custom radius, shadow and font-size
// names: without this, `cn("rounded-control", "rounded-card")` would keep both and the override would
// lose, and `text-body` would be taken for a color and removed by `text-fg`.
// Keep in step with --radius-*, --shadow-* and --text-* in globals.scss (cn.test.ts checks this).
export const CUSTOM_RADIUS = ["control", "card"];
export const CUSTOM_SHADOW = ["card"];
export const CUSTOM_TEXT = ["body", "button", "lead", "heading-xl", "heading-lg", "heading-md", "heading-sm"];

const twMerge = extendTailwindMerge({
  extend: { theme: { radius: CUSTOM_RADIUS, shadow: CUSTOM_SHADOW, text: CUSTOM_TEXT } },
});

/** Joins class names (strings, arrays, conditionals) and lets later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
