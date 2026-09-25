import Link from "next/link";
import { buttonVariants } from "@/components/atoms/Button";
import { EmailAddress } from "@/components/atoms/EmailAddress";
import { Heading } from "@/components/atoms/Heading";
import { Skeleton } from "@/components/atoms/Skeleton";
import { Alert } from "@/components/molecules/Alert";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ServiceBadges } from "@/components/molecules/ServiceBadges";
import { formatMobile, formatRegistered, type Lead } from "@/lib/leads";

export type LeadDetailProps = {
  /** null: no lead has this id (the lead query returned null). */
  lead: Lead | null;
  status?: "ready" | "loading" | "error";
  /** Where "Try again" goes after an error: usually the current URL. */
  retryHref?: string;
};

const contactLink = "text-fg-brand underline underline-offset-2 focus-visible:focus-ring";

/** One lead with their contact details and services. Email and mobile are mailto: and tel: links. */
export function LeadDetail({ lead, status = "ready", retryHref }: LeadDetailProps) {
  if (status === "loading") {
    return (
      <div aria-busy="true" className="space-y-3 rounded-card border border-border p-5">
        <span className="sr-only">Loading lead</span>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <Alert
        tone="error"
        title="We couldn't load this lead"
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

  if (!lead) return <EmptyState title="Lead not found" message="It may have been removed, or the link is incomplete." />;

  return (
    <article aria-labelledby="lead-name" className="rounded-card border border-border bg-surface p-5 shadow-card">
      <Heading level={2} size="lg" id="lead-name">
        {lead.name}
      </Heading>
      <p className="mt-1 text-sm text-fg-muted">
        Registered <time dateTime={lead.createdAt}>{formatRegistered(lead.createdAt)}</time>
      </p>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {/* Its own row: addresses are often longer than half the card. */}
        <div className="sm:col-span-2">
          <dt className="text-sm text-fg-muted">Email</dt>
          <dd className="break-words">
            <a href={`mailto:${lead.email}`} className={contactLink}>
              <EmailAddress email={lead.email} />
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">Mobile</dt>
          <dd>
            <a href={`tel:${lead.mobile}`} className={contactLink}>
              {formatMobile(lead.mobile)}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">Postcode</dt>
          <dd className="text-fg">{lead.postcode}</dd>
        </div>
      </dl>

      <Heading level={3} size="sm" className="mt-6">
        Interested in
      </Heading>
      <ServiceBadges services={lead.services} className="mt-2" />
    </article>
  );
}
