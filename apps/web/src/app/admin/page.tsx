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
import { dashboardHref, PAGE_SIZE, parseDashboardParams } from "@/lib/dashboard";
import { requireAdmin } from "@/lib/session";
import { signOutAction } from "./actions";

// The root layout adds " | Brighte Eats".
export const metadata: Metadata = { title: "Leads" };

/**
 * The leads dashboard: filter by service, page through, open a lead. Its state is in the URL.
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
      getLeads(token, params),
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
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (params.page > pageCount) redirect(dashboardHref({ ...params, page: pageCount }));

  const { service, page } = params;
  const serviceLabel = service && (serviceOptions.find((option) => option.code === service)?.label ?? service);

  return (
    <DashboardTemplate
      title="Leads"
      headerActions={<AccountMenu name={user.name} email={user.email} signOutAction={signOutAction} />}
      toolbar={
        <LeadsToolbar
          serviceOptions={serviceOptions}
          selectedService={service}
          hrefFor={(code) => dashboardHref({ service: code })}
          total={total}
        />
      }
      list={
        <LeadsTable
          leads={leads}
          hrefFor={(id) => dashboardHref({ service, page, lead: id })}
          selectedId={params.lead}
          caption={serviceLabel ? `Leads interested in ${serviceLabel}` : "All leads"}
          {...(serviceLabel && {
            emptyTitle: `No leads for ${serviceLabel}`,
            emptyMessage: "Nobody has chosen this service yet.",
            emptyAction: (
              <Link href={dashboardHref({})} className="font-semibold text-fg-brand underline focus-visible:focus-ring">
                Show all services
              </Link>
            ),
          })}
        />
      }
      pagination={
        total > PAGE_SIZE && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} itemLabel="leads" hrefFor={(n) => dashboardHref({ service, page: n })} />
        )
      }
      detail={selected !== undefined && <LeadDetail lead={selected} />}
      backToListHref={dashboardHref({ service, page })}
    />
  );
}
