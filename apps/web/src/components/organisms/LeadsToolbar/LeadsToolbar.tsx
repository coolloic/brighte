import { ServiceFilter, type ServiceFilterOption } from "@/components/molecules/ServiceFilter";

export type LeadsToolbarProps = {
  serviceOptions: ServiceFilterOption[];
  /** Selected service code; undefined = all services. */
  selectedService?: string;
  /** URL for a filter, e.g. (code) => (code ? `?service=${code}` : "?"). */
  hrefFor: (code?: string) => string;
  /** Leads matching the filter, across all pages. */
  total: number;
};

/** Filter chips and the number of matching leads. */
export function LeadsToolbar({ serviceOptions, selectedService, hrefFor, total }: LeadsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <ServiceFilter options={serviceOptions} selected={selectedService} hrefFor={hrefFor} />
      <p className="text-sm text-fg-muted">
        {total} {total === 1 ? "lead" : "leads"}
      </p>
    </div>
  );
}
