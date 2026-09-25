import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/atoms/Icon";

export type PaginationProps = {
  /** Current page, starting at 1. */
  page: number;
  pageSize: number;
  total: number;
  /** URL of a page, e.g. (page) => `?page=${page}`. Links keep back/forward and shareable URLs working. */
  hrefFor: (page: number) => string;
  /** What is being counted, e.g. "leads". */
  itemLabel?: string;
};

const pageLink =
  "inline-flex min-h-11 items-center gap-1 rounded-control border border-border-strong px-4 text-base font-semibold text-fg-brand transition-[background-color] duration-150 hover:bg-surface-brand focus-visible:focus-ring";

function PageLink({ href, disabled, rel, children }: { href: string; disabled: boolean; rel: "prev" | "next"; children: ReactNode }) {
  // At either end there is nowhere to go: show the control as inactive rather than a dead link.
  if (disabled) {
    return (
      <span aria-disabled="true" className={`${pageLink} cursor-not-allowed opacity-60`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} className={pageLink}>
      {children}
    </Link>
  );
}

export function Pagination({ page, pageSize, total, hrefFor, itemLabel = "items" }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-fg-muted">{total === 0 ? `No ${itemLabel}` : `Showing ${from}–${to} of ${total} ${itemLabel}`}</p>
      <div className="flex items-center gap-2">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1} rel="prev">
          <Icon name="chevron-left" className="size-4" />
          Previous
        </PageLink>
        <p className="px-1 text-sm text-fg">
          Page {page} of {pageCount}
        </p>
        <PageLink href={hrefFor(page + 1)} disabled={page >= pageCount} rel="next">
          Next
          <Icon name="chevron-right" className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}
