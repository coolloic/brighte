import "server-only";
import { cachedFor } from "../cached-for";
import { graphql } from "./client";
import { ApiError } from "./errors";
import { registrationFeedback, type RegistrationFeedback } from "./registration-feedback";

export type ServiceOption = { code: string; label: string };

export type RegistrationInput = {
  name: string;
  email: string;
  mobile: string;
  postcode: string;
  services: string[];
};

export type RegistrationResult = { ok: true } | ({ ok: false } & RegistrationFeedback);

const SERVICE_TYPES = /* GraphQL */ `
  query ServiceTypes {
    serviceTypes {
      code
      label
    }
  }
`;

const REGISTER = /* GraphQL */ `
  mutation Register($name: String!, $email: String!, $mobile: String!, $postcode: String!, $services: [String!]!) {
    register(name: $name, email: $email, mobile: $mobile, postcode: $postcode, services: $services) {
      id
    }
  }
`;

const DEFAULT_SERVICE_TYPES_CACHE_SECONDS = 300;

/**
 * How long the service types are kept: SERVICE_TYPES_CACHE_SECONDS (root .env), 5 minutes by
 * default, 0 for no cache. They change a few times a year: a new one shows up within this time, and
 * a retired one can still be offered for as long (register then rejects it with a field message).
 * Anything but a whole number of seconds, 0 or more, falls back to the default.
 */
export function serviceOptionsTtlMs(env: Record<string, string | undefined> = process.env): number {
  const raw = env.SERVICE_TYPES_CACHE_SECONDS;
  const seconds = raw ? Number(raw) : Number.NaN;
  return (Number.isInteger(seconds) && seconds >= 0 ? seconds : DEFAULT_SERVICE_TYPES_CACHE_SECONDS) * 1000;
}

/**
 * Service types a visitor can choose, in display order (the API leaves retired ones out). Kept for
 * serviceOptionsTtlMs() per server instance (cachedFor), so pages don't ask the API on every render.
 * A load forwards the IP of the visitor whose render started it, like any call: the API's rate limit
 * then counts retries during an outage per visitor, not in one bucket for the whole web server.
 */
export const getServiceOptions = cachedFor(serviceOptionsTtlMs(), async (): Promise<ServiceOption[]> => {
  const data = await graphql<{ serviceTypes: ServiceOption[] }>(SERVICE_TYPES);
  // Only what the form needs: nothing else from the API reaches the client.
  return data.serviceTypes.map(({ code, label }) => ({ code, label }));
});

/** Registers interest. Expected failures come back as feedback for the form; nothing is thrown for them. */
export async function registerInterest(input: RegistrationInput): Promise<RegistrationResult> {
  try {
    await graphql(REGISTER, input);
    return { ok: true };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.code === "INTERNAL_SERVER_ERROR" || error.code === "NETWORK_ERROR") console.error("register failed:", error.message);
    return { ok: false, ...registrationFeedback(error) };
  }
}
