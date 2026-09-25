import { useState } from "react";
import { Icon, ICON_NAMES, type IconName } from "@/components/atoms/Icon";
import { CopyButton, DocsPage } from "./DocsPage";

const SIZES = [
  { label: "16px", className: "size-4" },
  { label: "20px (default)", className: "" },
  { label: "24px", className: "size-6" },
];

/** The JSX to paste. The default size (20px) needs no className. */
export const iconSnippet = (name: IconName, sizeClass: string) =>
  sizeClass ? `<Icon name="${name}" className="${sizeClass}" />` : `<Icon name="${name}" />`;

export function IconGallery() {
  const [status, setStatus] = useState("");
  const [size, setSize] = useState("");
  return (
    <DocsPage
      title="Icons"
      status={status}
      hint="Click a snippet to copy it."
      intro={
        <p>
          Line icons drawn in the current text color, so they follow the text they sit next to (e.g. <code>text-danger</code>). They
          are hidden from screen readers unless given a <code>label</code>: add one only when the icon means something on its own.
          To add an icon, add its SVG to <code>components/atoms/Icon/Icon.tsx</code>.
        </p>
      }
    >
      <section className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Usage">
        <CopyButton text={'import { Icon } from "@/components/atoms/Icon";'} kind="import" announce={setStatus} />
        <div className="flex items-center gap-3">
          {/* Live example of a labelled icon: announced as "More information". */}
          <Icon name="info" label="More information" className="size-6 text-info" />
          <CopyButton text={'<Icon name="info" label="More information" />'} kind="labelled example" announce={setStatus} />
        </div>
      </section>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">Size</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SIZES.map((option) => (
            <label key={option.label} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-border px-3 text-sm">
              <input
                type="radio"
                name="icon-size"
                checked={size === option.className}
                onChange={() => setSize(option.className)}
                className="size-4 accent-control-checked focus-visible:focus-ring"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ICON_NAMES.map((name) => (
          <li key={name} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-card">
            <p className="flex min-h-8 items-center gap-3 font-semibold text-fg">
              <Icon name={name} className={size || undefined} />
              {name}
            </p>
            <CopyButton text={iconSnippet(name, size)} kind="snippet" announce={setStatus} />
          </li>
        ))}
      </ul>
    </DocsPage>
  );
}
