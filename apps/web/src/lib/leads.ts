// The shape of leads as the dashboard shows them (from the leads and lead GraphQL queries).

export type LeadService = { code: string; label: string };

export type Lead = {
  id: string;
  name: string;
  email: string;
  /** As stored by the API: 04xxxxxxxx. */
  mobile: string;
  postcode: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  services: LeadService[];
};

// Sydney time, so a date reads the same whatever timezone the viewer's browser or server is in.
const registeredFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" });

/** e.g. "25 Sept 2026, 9:15 am". */
export function formatRegistered(iso: string) {
  return registeredFormat.format(new Date(iso));
}

/** 0412345678 → "0412 345 678". Anything else is returned unchanged. */
export function formatMobile(mobile: string) {
  return /^04\d{8}$/.test(mobile) ? `${mobile.slice(0, 4)} ${mobile.slice(4, 7)} ${mobile.slice(7)}` : mobile;
}
