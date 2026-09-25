import Link from "next/link";
import type { ReactNode } from "react";
import { Heading } from "@/components/atoms/Heading";
import { Icon } from "@/components/atoms/Icon";
import { cn } from "@/lib/cn";
import { AppShell } from "../AppShell";

export type DashboardTemplateProps = {
  /** The page's h1. */
  title: string;
  headerActions?: ReactNode;
  /** e.g. <LeadsToolbar />. */
  toolbar?: ReactNode;
  /** e.g. <LeadsTable />. */
  list: ReactNode;
  /** e.g. <Pagination />. */
  pagination?: ReactNode;
  /** The selected item, e.g. <LeadDetail />. */
  detail?: ReactNode;
  /** Where "Back to all leads" goes when a selected item replaces the list on mobile. */
  backToListHref?: string;
};

/**
 * List page with an optional detail. From lg: list and a sticky detail column side by side. On mobile,
 * a selected item replaces the list (with a link back), instead of appearing under a long list.
 * CSS only, so it works as a Server Component.
 */
export function DashboardTemplate({ title, headerActions, toolbar, list, pagination, detail, backToListHref = "?" }: DashboardTemplateProps) {
  return (
    <AppShell headerActions={headerActions}>
      <Heading level={1}>{title}</Heading>
      <div className={cn("mt-6 grid gap-6", detail && "lg:grid-cols-[minmax(0,1fr)_24rem]")}>
        {/* With a selected item, the list is hidden on mobile (the detail takes its place). */}
        <div className={cn("min-w-0 space-y-4", detail && "hidden lg:block")}>
          {toolbar}
          {list}
          {pagination}
        </div>
        {detail && (
          <aside aria-label="Selected lead" className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Link
              href={backToListHref}
              className="inline-flex min-h-11 items-center gap-1 rounded-control font-semibold text-fg-brand focus-visible:focus-ring lg:hidden"
            >
              <Icon name="chevron-left" className="size-4" />
              Back to all leads
            </Link>
            {detail}
          </aside>
        )}
      </div>
    </AppShell>
  );
}
