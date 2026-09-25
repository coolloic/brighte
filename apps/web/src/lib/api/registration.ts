import "server-only";
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

/** Service types a visitor can choose, in display order (the API leaves retired ones out). */
export async function getServiceOptions(): Promise<ServiceOption[]> {
  const data = await graphql<{ serviceTypes: ServiceOption[] }>(SERVICE_TYPES);
  // Only what the form needs: nothing else from the API reaches the client.
  return data.serviceTypes.map(({ code, label }) => ({ code, label }));
}

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
