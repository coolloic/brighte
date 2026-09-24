import { useState, type ReactNode } from "react";
import { contrast, readToken, toHex, type Rgb } from "./color";
import { CONTRAST_PAIRS, PALETTE, paletteName, ROLE_GROUPS, type Source } from "./tokens";

type Announce = (message: string) => void;

function CopyButton({ text, kind, announce }: { text: string; kind: string; announce: Announce }) {
  const copy = () => {
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    (clipboard ? clipboard.writeText(text) : Promise.reject(new Error("Clipboard unavailable"))).then(
      () => announce(`Copied ${text}`),
      () => announce(`Couldn't copy ${text}. Select it and copy it manually.`),
    );
  };
  return (
    <button
      type="button"
      aria-label={`Copy ${kind} ${text}`}
      onClick={copy}
      className="min-h-11 w-full cursor-pointer rounded-control border border-border bg-surface px-3 py-2 text-left font-mono text-sm break-all text-fg transition-[background-color] duration-150 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {text}
    </button>
  );
}

function Page({ title, intro, status, children }: { title: string; intro: ReactNode; status: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-fg sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-2 max-w-3xl text-fg-muted">{intro}</div>
      <p role="status" className="sticky top-0 z-10 mt-4 min-h-11 rounded-control bg-surface-brand px-4 py-3 text-sm text-fg shadow-card">
        {status || "Click a token to copy it."}
      </p>
      {children}
    </main>
  );
}

function Swatch({ name }: { name: string }) {
  return (
    <div
      aria-hidden="true"
      className="h-16 rounded-control border border-border"
      style={{ background: `var(--color-${name})` }}
    />
  );
}

const WHITE: Rgb = [255, 255, 255];

function contrastLabel(ratio: number) {
  if (ratio >= 4.5) return "text";
  if (ratio >= 3) return "UI parts only";
  return "decorative only";
}

function ContrastNote({ value }: { value: Rgb }) {
  const dark = readToken("neutral-900") ?? [0, 0, 0];
  const onWhite = contrast(value, WHITE);
  const onDark = contrast(value, dark);
  return (
    <p className="text-sm text-fg-muted">
      On white {onWhite.toFixed(2)}:1 ({contrastLabel(onWhite)}) · on dark {onDark.toFixed(2)}:1 ({contrastLabel(onDark)})
    </p>
  );
}

const sourceLabel: Record<Source, string> = {
  brighte: "Brighte brand color",
  derived: "Derived shade",
};

export function PaletteColors() {
  const [status, setStatus] = useState("");
  return (
    <Page
      title="Color palette"
      status={status}
      intro={
        <p>
          Brighte&apos;s brand colors, read from <code>src/app/globals.scss</code>. Derived shades were added so text meets WCAG AA
          contrast. Components should use the roles (Foundations / Colors / Roles), not these directly.
        </p>
      }
    >
      {PALETTE.map(({ hue, label, steps }) => (
        <section key={hue} className="mt-8" aria-labelledby={`hue-${hue}`}>
          <h2 id={`hue-${hue}`} className="text-xl font-semibold">
            {label}
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map(({ step, source }) => {
              const name = paletteName(hue, step);
              const value = readToken(name);
              return (
                <li key={name} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3 shadow-card">
                  <Swatch name={name} />
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{name}</span>
                    <span className="font-mono text-sm text-fg-muted">{value ? toHex(value) : "missing"}</span>
                  </p>
                  <p className="text-sm text-fg-muted">{sourceLabel[source]}</p>
                  {value && <ContrastNote value={value} />}
                  <CopyButton text={`var(--color-${name})`} kind="CSS variable" announce={setStatus} />
                  <CopyButton text={name} kind="Tailwind color" announce={setStatus} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Page>
  );
}

export function RoleColors() {
  const [status, setStatus] = useState("");
  return (
    <Page
      title="Color roles"
      status={status}
      intro={
        <p>
          What components use. Each role points at a palette color, so the palette can change without touching components. Use the
          Tailwind class in components (<code>bg-action</code>) and the CSS variable in SCSS (<code>var(--color-action)</code>).
        </p>
      }
    >
      {ROLE_GROUPS.map(({ group, roles }) => (
        <section key={group} className="mt-8" aria-labelledby={`group-${group}`}>
          <h2 id={`group-${group}`} className="text-xl font-semibold">
            {group}
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => {
              const value = readToken(role.name);
              return (
                <li key={role.name} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3 shadow-card">
                  <Swatch name={role.name} />
                  <p className="font-semibold">{role.name}</p>
                  <p className="text-sm text-fg-muted">
                    {role.use}. Uses {role.maps} ({value ? toHex(value) : "missing"}).
                  </p>
                  <CopyButton text={role.utility} kind="Tailwind class" announce={setStatus} />
                  <CopyButton text={`var(--color-${role.name})`} kind="CSS variable" announce={setStatus} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Page>
  );
}

export function ContrastTable() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-fg sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Contrast</h1>
      <p className="mt-2 max-w-3xl text-fg-muted">
        Every role pairing components rely on, measured from the live CSS. WCAG 2.1 AA needs 4.5:1 for text and 3:1 for UI parts
        such as input outlines and focus rings. The story test fails if any pair drops below its minimum.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-xl border-collapse text-left text-sm">
          <caption className="sr-only">Contrast of each role pairing</caption>
          <thead>
            <tr className="border-b border-border-strong">
              <th scope="col" className="py-2 pr-4">Used for</th>
              <th scope="col" className="py-2 pr-4">Sample</th>
              <th scope="col" className="py-2 pr-4">Color on background</th>
              <th scope="col" className="py-2 pr-4">Ratio</th>
              <th scope="col" className="py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {CONTRAST_PAIRS.map((pair) => {
              const fg = readToken(pair.fg);
              const bg = readToken(pair.bg);
              const ratio = fg && bg ? contrast(fg, bg) : 0;
              return (
                <tr key={`${pair.fg}/${pair.bg}`} className="border-b border-border" data-ratio={ratio} data-min={pair.min}>
                  <td className="py-2 pr-4">{pair.use}</td>
                  <td className="py-2 pr-4">
                    {pair.min === 4.5 ? (
                      <span
                        className="inline-block rounded-control px-3 py-1 font-semibold"
                        style={{ color: `var(--color-${pair.fg})`, background: `var(--color-${pair.bg})` }}
                      >
                        Aa
                      </span>
                    ) : (
                      // UI parts (outlines, focus rings) need 3:1, not text contrast, so show a ring, not letters.
                      <span
                        aria-hidden="true"
                        className="inline-block h-8 w-12 rounded-control border-2"
                        style={{ background: `var(--color-${pair.bg})`, borderColor: `var(--color-${pair.fg})` }}
                      />
                    )}
                  </td>
                  <td className="py-2 pr-4 font-mono">
                    {pair.fg} on {pair.bg}
                  </td>
                  <td className="py-2 pr-4">
                    {ratio.toFixed(2)}:1 (min {pair.min}:1)
                  </td>
                  <td className="py-2 font-semibold">{ratio >= pair.min ? "Pass" : "Fail"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
