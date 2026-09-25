import "server-only";
import type { ApiLeadSort } from "@/lib/dashboard";
import type { Lead } from "@/lib/leads";
import { graphql } from "./client";
import { ApiError } from "./errors";

// ADMIN-only queries: pass the session token from requireAdmin().

const LEAD_FIELDS = /* GraphQL */ `
  id
  name
  email
  mobile
  postcode
  createdAt
  services {
    code
    label
  }
`;

const LEADS = /* GraphQL */ `
  query Leads($limit: Int!, $offset: Int!, $serviceType: String, $search: String, $sort: LeadSort!) {
    leads(limit: $limit, offset: $offset, serviceType: $serviceType, search: $search, sort: $sort) {
      total
      items { ${LEAD_FIELDS} }
    }
  }
`;

const LEAD = /* GraphQL */ `
  query Lead($id: ID!) {
    lead(id: $id) { ${LEAD_FIELDS} }
  }
`;

// Only the fields the dashboard shows reach the page.
const toLead = (lead: Lead): Lead => ({
  id: lead.id,
  name: lead.name,
  email: lead.email,
  mobile: lead.mobile,
  postcode: lead.postcode,
  createdAt: lead.createdAt,
  services: lead.services.map(({ code, label }) => ({ code, label })),
});

export type LeadsQuery = { page: number; pageSize: number; service?: string; search?: string; sort: ApiLeadSort };

/** One page of leads in the given order, optionally only those interested in `service` and matching `search`. */
export async function getLeads(token: string, { page, pageSize, service, search, sort }: LeadsQuery): Promise<{ leads: Lead[]; total: number }> {
  const { leads } = await graphql<{ leads: { total: number; items: Lead[] } }>(
    LEADS,
    // No filter or search: leave those variables out.
    { limit: pageSize, offset: (page - 1) * pageSize, sort, ...(service && { serviceType: service }), ...(search && { search }) },
    { token },
  );
  return { leads: leads.items.map(toLead), total: leads.total };
}

/** One lead, or null if there is none with this id (a malformed id counts as none). */
export async function getLead(token: string, id: string): Promise<Lead | null> {
  try {
    const { lead } = await graphql<{ lead: Lead | null }>(LEAD, { id }, { token });
    return lead && toLead(lead);
  } catch (error) {
    if (error instanceof ApiError && error.code === "BAD_USER_INPUT") return null;
    throw error;
  }
}
