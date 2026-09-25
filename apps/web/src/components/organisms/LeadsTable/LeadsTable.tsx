import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/atoms/Button";
import { Skeleton } from "@/components/atoms/Skeleton";
import { Alert } from "@/components/molecules/Alert";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ServiceBadges } from "@/components/molecules/ServiceBadges";
import { cn } from "@/lib/cn";
import { formatMobile, formatRegistered, type Lead } from "@/lib/leads";

export type LeadsTableProps = {
  leads: Lead[];
  /** URL of a lead's detail view, e.g. (id) => `/leads/${id}`. */
  hrefFor: (id: string) => string;
  /**
   * Lead shown in the detail view: tinted, its link marked aria-current. Its badges use the outline
   * look (see badgesFor), like a hovered row's.
   */
  selectedId?: string;
  status?: "ready" | "loading" | "error";
  /** Where "Try again" goes after an error: usually the current URL, which reloads the data. */
  retryHref?: string;
  /** Describes the list for screen readers, e.g. "Leads interested in Delivery". */
  caption?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
};

const COLUMNS = ["Name", "Email", "Mobile", "Postcode", "Services", "Registered"];

// A highlighted lead (selected or hovered) has a tinted background, where the default tinted badges
// would fade out. Its badges switch to the outline look: white pill with a green ring.
const badgesFor = (selected: boolean) =>
  selected
    ? ({ tone: "outline" } as const)
    : ({ tone: "brand", badgeClassName: "group-hover:bg-surface group-hover:ring-1 group-hover:ring-action group-hover:ring-inset" } as const);
const SKELETON_ROWS = [1, 2, 3];

// Stretched link: its ::after covers the whole row or card (the nearest `relative` ancestor), so the
// row is the click target while staying one link for keyboard and screen readers. Keyboard focus
// outlines the whole row; hovering the row underlines the name.
const nameLink = [
  "font-semibold text-fg-brand underline-offset-2 group-hover:underline",
  "after:absolute after:inset-0 focus-visible:outline-none",
  "focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus",
].join(" ");

/**
 * Leads as cards on mobile and a table from md up. The two layouts are both in the markup; the
 * hidden one is display:none, so screen readers only meet one. No client JavaScript: links and
 * "Try again" are plain URLs, so the page can be a Server Component.
 */
export function LeadsTable({
  leads,
  hrefFor,
  selectedId,
  status = "ready",
  retryHref,
  caption = "Leads",
  emptyTitle = "No leads yet",
  emptyMessage = "Leads appear here as soon as someone registers their interest.",
  emptyAction,
}: LeadsTableProps) {
  if (status === "loading") {
    // Same two layouts as the loaded list, so nothing jumps when the data arrives.
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading leads</span>
        <ul aria-hidden="true" className="space-y-3 md:hidden">
          {SKELETON_ROWS.map((row) => (
            <li key={row} className="rounded-card border border-border bg-surface p-4">
              <Skeleton className="h-6 w-40" />
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-56 max-w-full" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="mt-3 flex gap-1.5">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-4 w-48" />
            </li>
          ))}
        </ul>
        <table aria-hidden="true" className="hidden w-full border-collapse text-left text-sm md:table">
          <thead>
            <tr className="border-b border-border-strong text-fg">
              {COLUMNS.map((column) => (
                <th key={column} scope="col" className="py-3 pr-4 font-semibold first:pl-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SKELETON_ROWS.map((row) => (
              <tr key={row} className="border-b border-border">
                <td className="py-3 pr-4 pl-3"><Skeleton className="h-4 w-28" /></td>
                <td className="py-3 pr-4"><Skeleton className="h-4 w-44" /></td>
                <td className="py-3 pr-4"><Skeleton className="h-4 w-24" /></td>
                <td className="py-3 pr-4"><Skeleton className="h-4 w-10" /></td>
                <td className="py-3 pr-4">
                  <div className="flex gap-1.5">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </td>
                <td className="py-3"><Skeleton className="h-4 w-32" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (status === "error") {
    return (
      <Alert
        tone="error"
        title="We couldn't load the leads"
        action={
          retryHref && (
            <Link href={retryHref} className={buttonVariants({ variant: "secondary" })}>
              Try again
            </Link>
          )
        }
      >
        Check your connection and try again.
      </Alert>
    );
  }

  if (leads.length === 0) return <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />;

  const linkProps = (lead: Lead) => ({
    href: hrefFor(lead.id),
    "aria-current": lead.id === selectedId ? ("page" as const) : undefined,
  });

  return (
    <>
      {/* Mobile: one card per lead. */}
      <ul aria-label={caption} className="space-y-3 md:hidden">
        {leads.map((lead) => (
          <li
            key={lead.id}
            className={cn(
              "group relative rounded-card border p-4",
              lead.id === selectedId ? "border-action bg-surface-brand" : "border-border bg-surface hover:bg-surface-muted",
            )}
          >
            <Link {...linkProps(lead)} className={cn(nameLink, "text-lg")}>
              {lead.name}
            </Link>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-fg-muted">Email</dt>
              <dd className="break-all text-fg">{lead.email}</dd>
              <dt className="text-fg-muted">Mobile</dt>
              <dd className="text-fg">{formatMobile(lead.mobile)}</dd>
              <dt className="text-fg-muted">Postcode</dt>
              <dd className="text-fg">{lead.postcode}</dd>
            </dl>
            <ServiceBadges services={lead.services} {...badgesFor(lead.id === selectedId)} className="mt-3" />
            <p className="mt-2 text-sm text-fg-muted">
              Registered <time dateTime={lead.createdAt}>{formatRegistered(lead.createdAt)}</time>
            </p>
          </li>
        ))}
      </ul>

      {/* md and up: a table with the name as each row's header. */}
      <table className="hidden w-full border-collapse text-left text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border-strong text-fg">
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className="py-3 pr-4 font-semibold first:pl-3">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className={cn("group relative border-b border-border align-top", lead.id === selectedId ? "bg-surface-brand" : "hover:bg-surface-muted")}
            >
              <th scope="row" className="py-3 pr-4 pl-3 font-normal">
                <Link {...linkProps(lead)} className={nameLink}>
                  {lead.name}
                </Link>
              </th>
              <td className="py-3 pr-4 break-all text-fg">{lead.email}</td>
              <td className="py-3 pr-4 whitespace-nowrap text-fg">{formatMobile(lead.mobile)}</td>
              <td className="py-3 pr-4 text-fg">{lead.postcode}</td>
              <td className="py-3 pr-4">
                <ServiceBadges services={lead.services} {...badgesFor(lead.id === selectedId)} />
              </td>
              <td className="py-3 whitespace-nowrap text-fg-muted">
                <time dateTime={lead.createdAt}>{formatRegistered(lead.createdAt)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
