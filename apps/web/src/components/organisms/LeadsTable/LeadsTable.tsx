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
   * Lead shown in the detail view: marked with a green bar (desktop) or border (mobile) and a bold
   * name, and its link gets aria-current. The background stays as is, so badges keep their contrast.
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

const nameLink = "font-semibold text-fg-brand underline-offset-2 hover:underline focus-visible:focus-ring";

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
    return (
      <div aria-busy="true" className="space-y-3">
        <span className="sr-only">Loading leads</span>
        {[1, 2, 3].map((row) => (
          <div key={row} className="space-y-2 rounded-card border border-border p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
        ))}
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
            // Selected: a 2px green edge via border + inset ring, so the card doesn't shift.
            className={cn("rounded-card border bg-surface p-4", lead.id === selectedId ? "border-action ring-1 ring-action ring-inset" : "border-border")}
          >
            <Link {...linkProps(lead)} className={cn(nameLink, "text-lg", lead.id === selectedId && "font-bold")}>
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
            <ServiceBadges services={lead.services} className="mt-3" />
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
            {["Name", "Email", "Mobile", "Postcode", "Services", "Registered"].map((column) => (
              <th key={column} scope="col" className="py-3 pr-4 font-semibold first:pl-3">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-border align-top">
              {/* Selected: a 4px green bar inside the name cell. */}
              <th
                scope="row"
                className={cn("py-3 pr-4 pl-3 font-normal", lead.id === selectedId && "shadow-[inset_4px_0_0_var(--color-action)]")}
              >
                <Link {...linkProps(lead)} className={cn(nameLink, lead.id === selectedId && "font-bold")}>
                  {lead.name}
                </Link>
              </th>
              <td className="py-3 pr-4 break-all text-fg">{lead.email}</td>
              <td className="py-3 pr-4 whitespace-nowrap text-fg">{formatMobile(lead.mobile)}</td>
              <td className="py-3 pr-4 text-fg">{lead.postcode}</td>
              <td className="py-3 pr-4">
                <ServiceBadges services={lead.services} />
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
