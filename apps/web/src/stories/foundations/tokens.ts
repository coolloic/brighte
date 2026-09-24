// Documentation of the color tokens in src/app/globals.scss. The values themselves are read from
// the live CSS at runtime (see color.ts), so this file only lists names and meaning; the
// Foundations/Colors stories fail if a name here does not exist in globals.scss.

export type Source = "brighte" | "derived";

export type PaletteHue = {
  hue: string;
  label: string;
  steps: Step[];
};

type Step = { step: string; source: Source };
const brighte = (...steps: string[]): Step[] => steps.map((step) => ({ step, source: "brighte" }));
const derived = (step: string): Step => ({ step, source: "derived" });

export const PALETTE: PaletteHue[] = [
  { hue: "white", label: "White", steps: [{ step: "", source: "brighte" }] },
  {
    hue: "neutral",
    label: "Neutral (Brighte dark #1e2028 blended over white)",
    steps: [...["50", "100", "200", "300", "400", "500", "600", "700", "800"].map(derived), ...brighte("900")],
  },
  { hue: "green", label: "Green (brand)", steps: [...brighte("50", "100", "200", "400", "500", "600", "700"), derived("800")] },
  { hue: "blue", label: "Blue", steps: [...brighte("50", "400", "500", "600"), derived("700")] },
  { hue: "lavender", label: "Lavender", steps: brighte("50", "100", "200", "300") },
  { hue: "yellow", label: "Yellow", steps: [...brighte("50", "300", "400", "500", "600"), derived("800")] },
  { hue: "red", label: "Red", steps: [...brighte("50", "300", "400", "500", "600"), derived("700")] },
];

/** Palette token name without the `--color-` prefix, e.g. `green-500` or `white`. */
export const paletteName = (hue: string, step: string) => (step ? `${hue}-${step}` : hue);

export type Role = {
  /** Token name without `--color-`, e.g. `action`. Tailwind classes use it: `bg-action`. */
  name: string;
  /** Palette token it points at. */
  maps: string;
  /** Typical Tailwind class. */
  utility: string;
  use: string;
};

export const ROLE_GROUPS: { group: string; roles: Role[] }[] = [
  {
    group: "Surfaces",
    roles: [
      { name: "canvas", maps: "white", utility: "bg-canvas", use: "Page background" },
      { name: "surface", maps: "white", utility: "bg-surface", use: "Cards, form panels" },
      { name: "surface-muted", maps: "neutral-50", utility: "bg-surface-muted", use: "Table stripes, subtle sections" },
      { name: "surface-brand", maps: "green-50", utility: "bg-surface-brand", use: "Highlighted, on-brand sections" },
    ],
  },
  {
    group: "Text and icons",
    roles: [
      { name: "fg", maps: "neutral-900", utility: "text-fg", use: "Body text and headings" },
      { name: "fg-muted", maps: "neutral-600", utility: "text-fg-muted", use: "Hints, secondary text" },
      { name: "fg-inverse", maps: "white", utility: "text-fg-inverse", use: "Text on dark backgrounds" },
      { name: "fg-brand", maps: "green-800", utility: "text-fg-brand", use: "Links, brand accents in text" },
    ],
  },
  {
    group: "Lines",
    roles: [
      { name: "border", maps: "neutral-200", utility: "border-border", use: "Dividers, card outlines (decorative)" },
      { name: "border-strong", maps: "neutral-500", utility: "border-border-strong", use: "Input outlines (3:1, WCAG 1.4.11)" },
    ],
  },
  {
    group: "Call to action and focus",
    roles: [
      { name: "action", maps: "green-500", utility: "bg-action", use: "Primary button background" },
      { name: "action-hover", maps: "green-600", utility: "hover:bg-action-hover", use: "Primary button hover" },
      { name: "on-action", maps: "neutral-900", utility: "text-on-action", use: "Text on the primary button (white fails)" },
      { name: "focus", maps: "green-700", utility: "outline-focus", use: "Keyboard focus ring" },
    ],
  },
  {
    group: "Status",
    roles: [
      { name: "success", maps: "green-800", utility: "text-success", use: "Success text, icon, border" },
      { name: "success-surface", maps: "green-50", utility: "bg-success-surface", use: "Success banner background" },
      { name: "danger", maps: "red-700", utility: "text-danger", use: "Error text, icon, invalid input border" },
      { name: "danger-surface", maps: "red-50", utility: "bg-danger-surface", use: "Error banner background" },
      { name: "warning", maps: "yellow-800", utility: "text-warning", use: "Warning text, icon, border" },
      { name: "warning-surface", maps: "yellow-50", utility: "bg-warning-surface", use: "Warning banner background" },
      { name: "info", maps: "blue-700", utility: "text-info", use: "Info text, icon, border" },
      { name: "info-surface", maps: "blue-50", utility: "bg-info-surface", use: "Info banner background" },
    ],
  },
];

export const ROLES = ROLE_GROUPS.flatMap((g) => g.roles);

/** WCAG AA minimums: 4.5 for text, 3 for UI parts such as borders and focus rings. */
export const CONTRAST_PAIRS: { fg: string; bg: string; min: 3 | 4.5; use: string }[] = [
  { fg: "fg", bg: "canvas", min: 4.5, use: "Body text" },
  { fg: "fg", bg: "surface-muted", min: 4.5, use: "Text on subtle sections" },
  { fg: "fg-muted", bg: "canvas", min: 4.5, use: "Hints and secondary text" },
  { fg: "fg-muted", bg: "surface-muted", min: 4.5, use: "Secondary text on subtle sections" },
  { fg: "fg-brand", bg: "canvas", min: 4.5, use: "Links" },
  { fg: "fg-brand", bg: "surface-brand", min: 4.5, use: "Links on brand sections" },
  { fg: "fg-inverse", bg: "fg", min: 4.5, use: "Inverse text (tooltips)" },
  { fg: "on-action", bg: "action", min: 4.5, use: "Primary button label" },
  { fg: "on-action", bg: "action-hover", min: 4.5, use: "Primary button label on hover" },
  { fg: "border-strong", bg: "canvas", min: 3, use: "Input outline" },
  { fg: "focus", bg: "canvas", min: 3, use: "Focus ring on the page" },
  { fg: "focus", bg: "surface-muted", min: 3, use: "Focus ring on subtle sections" },
  { fg: "focus", bg: "surface-brand", min: 3, use: "Focus ring on brand sections" },
  { fg: "success", bg: "canvas", min: 4.5, use: "Success text" },
  { fg: "success", bg: "success-surface", min: 4.5, use: "Success banner text" },
  { fg: "danger", bg: "canvas", min: 4.5, use: "Field error text" },
  { fg: "danger", bg: "danger-surface", min: 4.5, use: "Error banner text" },
  { fg: "warning", bg: "canvas", min: 4.5, use: "Warning text" },
  { fg: "warning", bg: "warning-surface", min: 4.5, use: "Warning banner text" },
  { fg: "info", bg: "canvas", min: 4.5, use: "Info text" },
  { fg: "info", bg: "info-surface", min: 4.5, use: "Info banner text" },
];
