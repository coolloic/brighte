import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/molecules/AccountMenu";
import { Pagination } from "@/components/molecules/Pagination";
import { LeadDetail } from "@/components/organisms/LeadDetail";
import { LeadsTable } from "@/components/organisms/LeadsTable";
import { LeadsToolbar } from "@/components/organisms/LeadsToolbar";
import { DashboardTemplate } from "@/components/templates/DashboardTemplate";
import { ApiError } from "@/lib/api/errors";
import { getLead, getLeads } from "@/lib/api/leads";
import { getServiceOptions } from "@/lib/api/registration";
import { dashboardHref, nextSort, parseDashboardParams, SORTS, sortState } from "@/lib/dashboard";
import { requireAdmin } from "@/lib/session";
import { LeadsControls } from "./_components/LeadsControls";
import { PageSizeControl } from "./_components/PageSizeControl";
import { signOutAction } from "./actions";

// The root layout adds " | Brighte Eats".
export const metadata: Metadata = { title: "Leads" };

/**
 * The leads dashboard: search, filter by service, sort, choose the page size, page through, open a
 * lead. Its state is in the URL.
 * No loading.tsx on purpose: it would stream a skeleton before the session check, so signed-out
 * visitors would see it flash and get a client-side redirect instead of a real one.
 */
export default async function LeadsPage({ searchParams }: PageProps<"/admin">) {
  const params = parseDashboardParams(await searchParams);
  const here = dashboardHref(params);
  const { user, token } = await requireAdmin(here);

  let data;
  try {
    data = await Promise.all([
      getServiceOptions(),
      getLeads(token, { page: params.page, pageSize: params.size, service: params.service, search: params.q, sort: SORTS[params.sort] }),
      params.lead ? getLead(token, params.lead) : Promise.resolve(undefined),
    ]);
  } catch (error) {
    // The session ended since requireAdmin() (e.g. the token just expired): sign in again, then come back.
    if (error instanceof ApiError && (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN")) {
      redirect(`/admin/login?next=${encodeURIComponent(here)}`);
    }
    throw error; // app/error.tsx
  }
  const [serviceOptions, { leads, total }, selected] = data;

  // Past the last page (e.g. an old link after leads were filtered): go to the last one.
  const pageCount = Math.max(1, Math.ceil(total / params.size));
  if (params.page > pageCount) redirect(dashboardHref({ ...params, page: pageCount }));

  const { q, service, sort, size } = params;
  const serviceLabel = service && (serviceOptions.find((option) => option.code === service)?.label ?? service);
  const emptyLink = "font-semibold text-fg-brand underline focus-visible:focus-ring";
  // What the list shows when it's empty: a search that matched nothing, a service nobody chose yet, or no leads at all.
  const empty = q
    ? {
        emptyTitle: `No leads match “${q}”`,
        emptyMessage: "Try a different name, email, mobile or postcode.",
        emptyAction: (
          <Link href={dashboardHref({ ...params, q: undefined, page: 1, lead: undefined })} className={emptyLink}>
            Clear search
          </Link>
        ),
      }
    : serviceLabel
      ? {
          emptyTitle: `No leads for ${serviceLabel}`,
          emptyMessage: "Nobody has chosen this service yet.",
          emptyAction: (
            <Link href={dashboardHref({ sort, size })} className={emptyLink}>
              Show all services
            </Link>
          ),
        }
      : {};

  return (
    <DashboardTemplate
      title="Leads"
      headerActions={<AccountMenu name={user.name} email={user.email} signOutAction={signOutAction} />}
      toolbar={
        <div className="space-y-4">
          <LeadsControls params={params} />
          <LeadsToolbar
            serviceOptions={serviceOptions}
            selectedService={service}
            // A new filter keeps the search, sort and page size, and starts at page 1.
            hrefFor={(code) => dashboardHref({ q, sort, size, service: code })}
            total={total}
          />
        </div>
      }
      list={
        <LeadsTable
          leads={leads}
          hrefFor={(id) => dashboardHref({ ...params, lead: id })}
          selectedId={params.lead}
          caption={[serviceLabel ? `Leads interested in ${serviceLabel}` : "All leads", q && `matching “${q}”`].filter(Boolean).join(" ")}
          sort={sortState(sort)}
          // A header sorts by its column (the other way round if it already does), from page 1.
          sortHrefFor={(column) => dashboardHref({ ...params, sort: nextSort(sort, column), page: 1 })}
          {...empty}
        />
      }
      pagination={
        // Whenever there are leads, so the page size can change even when they fit on one page.
        total > 0 && (
          <Pagination
            page={params.page}
            pageSize={size}
            total={total}
            itemLabel="leads"
            hrefFor={(n) => dashboardHref({ ...params, page: n, lead: undefined })}
            pageSizeControl={<PageSizeControl params={params} />}
          />
        )
      }
      detail={selected !== undefined && <LeadDetail lead={selected} />}
      backToListHref={dashboardHref({ ...params, lead: undefined })}
    />
  );
}
