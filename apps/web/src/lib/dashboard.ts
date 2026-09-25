// The leads dashboard's state lives in its URL (/admin?service=delivery&page=2&lead=<id>), so back,
// forward, reload and shared links all work, and the page needs no client JavaScript.

export const PAGE_SIZE = 20;

export type DashboardParams = {
  /** Service type code to filter by; undefined = all services. */
  service?: string;
  /** 1-based. */
  page: number;
  /** The selected lead's id. */
  lead?: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

/** Reads the URL's query. Anything invalid falls back to the default rather than failing. */
export function parseDashboardParams(searchParams: SearchParams): DashboardParams {
  const page = Number(first(searchParams.page));
  return {
    service: first(searchParams.service),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    lead: first(searchParams.lead),
  };
}

/** The dashboard URL for these params; page 1 and empty values are left out. */
export function dashboardHref({ service, page = 1, lead }: Partial<DashboardParams>): string {
  const query = new URLSearchParams();
  if (service) query.set("service", service);
  if (page > 1) query.set("page", String(page));
  if (lead) query.set("lead", lead);
  const search = query.toString();
  return search ? `/admin?${search}` : "/admin";
}
