// The leads dashboard's state lives in its URL
// (/admin?q=ada&service=delivery&sort=name_asc&size=50&page=2&lead=<id>), so back, forward,
// reload and shared links all work, and the page needs no client JavaScript.

/** Sort keys in the URL, and the API order each one asks for. The default is newest first. */
export const SORTS = {
  newest: "NEWEST_FIRST",
  oldest: "OLDEST_FIRST",
  name_asc: "NAME_ASC",
  name_desc: "NAME_DESC",
  email_asc: "EMAIL_ASC",
  email_desc: "EMAIL_DESC",
  postcode_asc: "POSTCODE_ASC",
  postcode_desc: "POSTCODE_DESC",
} as const;
export type DashboardSort = keyof typeof SORTS;
export type ApiLeadSort = (typeof SORTS)[DashboardSort];
export const DEFAULT_SORT: DashboardSort = "newest";

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

/** Columns that can be sorted, and the sort keys for each direction. Registered sorts newest first on the first click. */
export const SORT_COLUMNS = {
  name: { ascending: "name_asc", descending: "name_desc", first: "ascending" },
  email: { ascending: "email_asc", descending: "email_desc", first: "ascending" },
  postcode: { ascending: "postcode_asc", descending: "postcode_desc", first: "ascending" },
  registered: { ascending: "oldest", descending: "newest", first: "descending" },
} as const satisfies Record<string, { ascending: DashboardSort; descending: DashboardSort; first: "ascending" | "descending" }>;
export type SortColumn = keyof typeof SORT_COLUMNS;
export type SortDirection = "ascending" | "descending";

export type DashboardParams = {
  /** Search text; undefined = no search. */
  q?: string;
  /** Service type code to filter by; undefined = all services. */
  service?: string;
  sort: DashboardSort;
  size: PageSize;
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
  const sort = first(searchParams.sort);
  const size = Number(first(searchParams.size));
  return {
    // The API accepts up to 100 characters.
    q: first(searchParams.q)?.slice(0, 100),
    service: first(searchParams.service),
    sort: sort && sort in SORTS ? (sort as DashboardSort) : DEFAULT_SORT,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? (size as PageSize) : DEFAULT_PAGE_SIZE,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    lead: first(searchParams.lead),
  };
}

/** The dashboard URL for these params; defaults (newest, 20 per page, page 1) and empty values are left out. */
export function dashboardHref({ q, service, sort = DEFAULT_SORT, size = DEFAULT_PAGE_SIZE, page = 1, lead }: Partial<DashboardParams>): string {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (service) query.set("service", service);
  if (sort !== DEFAULT_SORT) query.set("sort", sort);
  if (size !== DEFAULT_PAGE_SIZE) query.set("size", String(size));
  if (page > 1) query.set("page", String(page));
  if (lead) query.set("lead", lead);
  const search = query.toString();
  return search ? `/admin?${search}` : "/admin";
}

/** Which column (if any) the current sort is on, and in which direction. */
export function sortState(sort: DashboardSort): { column: SortColumn; direction: SortDirection } | undefined {
  for (const [column, keys] of Object.entries(SORT_COLUMNS) as [SortColumn, (typeof SORT_COLUMNS)[SortColumn]][]) {
    if (keys.ascending === sort) return { column, direction: "ascending" };
    if (keys.descending === sort) return { column, direction: "descending" };
  }
  return undefined;
}

/** The sort a column header switches to: the other direction if it's the current column, else its first direction. */
export function nextSort(current: DashboardSort, column: SortColumn): DashboardSort {
  const state = sortState(current);
  const keys = SORT_COLUMNS[column];
  if (state?.column === column) return state.direction === "ascending" ? keys.descending : keys.ascending;
  return keys[keys.first];
}
