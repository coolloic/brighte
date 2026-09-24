// Reads color tokens from the live CSS and computes WCAG contrast.

export type Rgb = [number, number, number];

/**
 * The color a token resolves to, or null if the token does not exist. Uses a probe element so
 * var() chains (roles pointing at palette colors) are resolved by the browser.
 */
export function readToken(name: string): Rgb | null {
  const probe = document.createElement("span");
  probe.style.color = `var(--color-${name}, transparent)`;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  const match = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(value);
  if (!match || match[4] === "0") return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

function luminance([r, g, b]: Rgb) {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio, 1 to 21. */
export function contrast(a: Rgb, b: Rgb) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
