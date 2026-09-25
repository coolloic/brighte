"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { LeadsSearchForm } from "@/components/organisms/LeadsSearchForm";
import { dashboardHref, type DashboardParams, type DashboardSort } from "@/lib/dashboard";

/** Waits this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 300;

const SORT_OPTIONS: { value: DashboardSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "email_asc", label: "Email A–Z" },
  { value: "email_desc", label: "Email Z–A" },
  { value: "postcode_asc", label: "Postcode, low to high" },
  { value: "postcode_desc", label: "Postcode, high to low" },
];

/**
 * Makes LeadsSearchForm update the dashboard URL as the admin works: search after a short pause in
 * typing (debounced), sort at once. Every change goes back to page 1. The first search adds a
 * history entry (Back returns to the full list); refining it replaces that entry, so typing doesn't
 * fill the history. Without JavaScript, the form's Search button does it.
 */
export function LeadsControls({ params }: { params: DashboardParams }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [query, setQuery] = useState(params.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // The URL as it is now. A debounced search fires after later renders, and building its URL from
  // the params it was typed with would undo a sort or filter changed in the meantime.
  const latestParams = useRef(params);
  useEffect(() => {
    latestParams.current = params;
  });

  // Text waiting out the pause before its search, and text held back from searching while a link
  // (a column sort, a service filter, a lead) loads: searching then would replace that navigation
  // with one built from the old URL. The held-back search runs once the link's page arrives.
  const waiting = useRef<string>(undefined);
  const heldBack = useRef<string>(undefined);
  useEffect(() => {
    const holdBack = (event: MouseEvent) => {
      if (waiting.current === undefined || !(event.target instanceof Element) || !event.target.closest('a[href^="/"]')) return;
      clearTimeout(timer.current);
      heldBack.current = waiting.current;
      waiting.current = undefined;
    };
    document.addEventListener("click", holdBack, true);
    return () => document.removeEventListener("click", holdBack, true);
  }, []);

  // The URL's search changed. If it's the search this box sent, leave the box alone: the admin may
  // have typed more while it loaded, and copying the URL back would erase those letters. Otherwise
  // it came from elsewhere (Back, a "Clear search" link): show it in the box.
  const [shownQ, setShownQ] = useState(params.q);
  const [sentQ, setSentQ] = useState(params.q);
  if (params.q !== shownQ) {
    setShownQ(params.q);
    if (params.q !== sentQ) {
      setSentQ(params.q);
      setQuery(params.q ?? "");
    }
  }

  const go = (changes: Partial<DashboardParams>, history: "push" | "replace" = "push") => {
    const { q, service, sort, size, lead } = latestParams.current;
    const href = dashboardHref({ q, service, sort, size, lead, ...changes, page: 1 });
    startTransition(() => router[history](href, { scroll: false }));
  };
  // A new search can drop the selected lead out of the list: close its detail too.
  const search = (text: string) => {
    const q = text.trim() || undefined;
    // Only the first search adds a history entry; sentQ is already set while that one is loading.
    go({ q, lead: undefined }, sentQ ? "replace" : "push");
    setSentQ(q);
  };
  const searchHeldBack = useEffectEvent(() => {
    if (heldBack.current === undefined) return;
    const q = heldBack.current.trim() || undefined;
    heldBack.current = undefined;
    // Keeps a lead the link just opened, and replaces the link's history entry: one step for both.
    go({ q }, "replace");
    setSentQ(q);
  });
  useEffect(() => searchHeldBack(), [params]);

  return (
    <LeadsSearchForm
      action="/admin"
      query={query}
      onQueryChange={(value) => {
        setQuery(value);
        clearTimeout(timer.current);
        waiting.current = value;
        timer.current = setTimeout(() => {
          waiting.current = undefined;
          search(value);
        }, SEARCH_DELAY_MS);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        clearTimeout(timer.current);
        waiting.current = undefined;
        search(query);
      }}
      sort={params.sort}
      sortOptions={SORT_OPTIONS}
      onSortChange={(value) => {
        // Take a search still waiting out its pause along, instead of letting it land after this.
        clearTimeout(timer.current);
        waiting.current = undefined;
        const q = query.trim() || undefined;
        go({ sort: value as DashboardSort, q, ...(q !== params.q && { lead: undefined }) });
        setSentQ(q);
      }}
      hiddenFields={{ service: params.service, size: String(params.size) }}
      busy={busy}
    />
  );
}
