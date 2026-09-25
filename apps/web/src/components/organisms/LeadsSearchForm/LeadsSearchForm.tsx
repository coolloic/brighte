import type { FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Input } from "@/components/atoms/Input";
import { Label } from "@/components/atoms/Label";
import { Select } from "@/components/atoms/Select";

export type LeadsSearchFormProps = {
  /** Where the form goes without JavaScript (a GET, so the choices land in the URL), e.g. "/admin". */
  action: string;
  query: string;
  onQueryChange: (value: string) => void;
  sort: string;
  sortOptions: { value: string; label: string }[];
  onSortChange: (value: string) => void;
  /** Kept when the form is submitted, e.g. the service filter and page size. */
  hiddenFields?: Record<string, string | undefined>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Results are on their way. */
  busy?: boolean;
};

/**
 * Search and sort for the leads list. A plain GET form, so it works without JavaScript: then a
 * Search button applies it. With JavaScript the list follows the typing and there is no button
 * (Enter still submits: a form with one text field submits on Enter without one). "Sort by" is for
 * phones only: from md up the table's column headers sort.
 */
export function LeadsSearchForm({
  action,
  query,
  onQueryChange,
  sort,
  sortOptions,
  onSortChange,
  hiddenFields = {},
  onSubmit,
  busy = false,
}: LeadsSearchFormProps) {
  return (
    <form role="search" aria-label="Leads" action={action} method="get" onSubmit={onSubmit} aria-busy={busy || undefined} className="flex flex-col gap-3 md:flex-row md:items-end">
      {Object.entries(hiddenFields).map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}
      <div className="flex-1">
        <Label htmlFor="lead-search">Search leads</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-fg-muted" />
            <Input
              id="lead-search"
              name="q"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Name, email, mobile or postcode"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={100}
              // The browser's clear (×) button is clickable: show the pointer on it too.
              className="pl-10 [&::-webkit-search-cancel-button]:cursor-pointer"
            />
          </div>
          {/* Only without JavaScript: with it, the results follow the typing. */}
          <noscript>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </noscript>
        </div>
      </div>
      {/* Phones only: from md up the column headers sort. */}
      <div className="md:hidden">
        <Label htmlFor="lead-sort">Sort by</Label>
        <Select id="lead-sort" name="sort" value={sort} onChange={(event) => onSortChange(event.target.value)}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </form>
  );
}
