import type { Lead } from "@/lib/leads";

// Mock leads for dashboard stories, shaped like the leads and lead queries' results.
export const SERVICE_OPTIONS = [
  { code: "delivery", label: "Delivery" },
  { code: "pick-up", label: "Pick-up" },
  { code: "payment", label: "Payment" },
];

export const LEADS: Lead[] = [
  {
    id: "019a2b3c-4d5e-7f60-8a7b-1c2d3e4f5a01",
    name: "Ada Lovelace",
    email: "ada@example.com",
    mobile: "0412345678",
    postcode: "2000",
    createdAt: "2026-09-24T23:15:00Z",
    services: [
      { code: "delivery", label: "Delivery" },
      { code: "payment", label: "Payment" },
    ],
  },
  {
    id: "019a2b3c-4d5e-7f60-8a7b-1c2d3e4f5a02",
    name: "Grace Hopper",
    email: "grace.hopper@example.com.au",
    mobile: "0498765432",
    postcode: "3000",
    createdAt: "2026-09-24T05:02:00Z",
    services: [{ code: "pick-up", label: "Pick-up" }],
  },
  {
    id: "019a2b3c-4d5e-7f60-8a7b-1c2d3e4f5a03",
    name: "Katherine Johnson",
    email: "k.johnson@example.org",
    mobile: "0400111222",
    postcode: "0800",
    createdAt: "2026-09-23T01:30:00Z",
    services: [
      { code: "delivery", label: "Delivery" },
      { code: "pick-up", label: "Pick-up" },
      { code: "payment", label: "Payment" },
    ],
  },
];

export const leadHref = (id: string) => `/leads/${id}`;
