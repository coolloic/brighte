import { Badge, type BadgeProps } from "@/components/atoms/Badge";
import { Icon, type IconName } from "@/components/atoms/Icon";
import type { MatchBlock, MatchStatus } from "@/lib/chat";
import { cn } from "@/lib/cn";

export type MatchReportProps = MatchBlock & { className?: string };

const STATUS: Record<MatchStatus, { label: string; count: string; tone: NonNullable<BadgeProps["tone"]>; icon: IconName }> = {
  met: { label: "Met", count: "met", tone: "success", icon: "check-circle" },
  partial: { label: "Partly", count: "partly", tone: "warning", icon: "alert-circle" },
  missing: { label: "Missing", count: "missing", tone: "danger", icon: "x" },
};
const ORDER: MatchStatus[] = ["met", "partial", "missing"];

/**
 * How well something matches a list of requirements, e.g. a CV against a job ad: the overall score,
 * then each requirement with its status (in words and colour), the evidence for it, and a suggestion.
 * A list rather than a table, so it reads at a phone's width. Presentational.
 */
export function MatchReport({ title, score, summary, items, className }: MatchReportProps) {
  const counts = ORDER.map((status) => [status, items.filter((item) => item.status === status).length] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${STATUS[status].count}`)
    .join(" · ");

  return (
    <article className={cn("my-2 rounded-card border border-border bg-surface p-4 break-words first:mt-0 last:mb-0", className)}>
      <h3 className="text-lead font-semibold">{title}</h3>
      <p className="mt-2">
        <span className="text-heading-md font-bold">{score}%</span> match
      </p>
      {/* The bar repeats the number above, so it is hidden from screen readers. SVG attributes, not a
          style attribute: the CSP allows no inline styles. */}
      <svg aria-hidden="true" viewBox="0 0 100 2" preserveAspectRatio="none" className="mt-1 h-2 w-full overflow-hidden rounded-full">
        <rect width="100" height="2" className="fill-border" />
        <rect width={score} height="2" className="fill-action" />
      </svg>
      {summary && <p className="mt-2">{summary}</p>}
      <p className="mt-2 text-sm text-fg-muted">{counts}</p>
      <ul className="mt-3 space-y-3">
        {items.map((item, index) => {
          const status = STATUS[item.status];
          return (
            // The model's order; requirements can repeat.
            <li key={index} className="border-t border-border pt-3">
              <Badge tone={status.tone} className="gap-1">
                <Icon name={status.icon} className="size-4" />
                {status.label}
              </Badge>
              <p className="mt-1 font-semibold">{item.requirement}</p>
              {item.evidence && <p className="mt-1 text-fg-muted">{item.evidence}</p>}
              {item.suggestion && (
                <p className="mt-1">
                  <span className="font-semibold">Suggestion:</span> {item.suggestion}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
