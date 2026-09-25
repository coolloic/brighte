import Link from "next/link";
import { Icon } from "@/components/atoms/Icon";
import { cn } from "@/lib/cn";

export type ServiceFilterOption = { code: string; label: string };

export type ServiceFilterProps = {
  options: ServiceFilterOption[];
  /** Selected service code; undefined means all services. */
  selected?: string;
  /** URL for a filter, e.g. (code) => (code ? `?service=${code}` : "?"). */
  hrefFor: (code?: string) => string;
  label?: string;
};

/**
 * Filter chips as links, so the filtered view is a URL (back button, sharing, no client JavaScript).
 * The current chip is marked with aria-current and a tick; its colors are AAA (white on green would
 * only be AA at this size).
 */
export function ServiceFilter({ options, selected, hrefFor, label = "Filter by service" }: ServiceFilterProps) {
  const chips = [{ code: undefined, label: "All services" }, ...options];
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const current = chip.code === selected;
          return (
            <li key={chip.code ?? "all"}>
              <Link
                href={hrefFor(chip.code)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-body font-semibold transition-[background-color] duration-150 focus-visible:focus-ring",
                  current ? "border-action bg-surface-brand text-fg-brand" : "border-border-strong text-fg hover:bg-surface-muted",
                )}
              >
                {current && <Icon name="check-circle" className="size-4" />}
                {chip.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
