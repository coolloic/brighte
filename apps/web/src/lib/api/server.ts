// Server-only public API of the API layer: the operations, built on graphql() (the API's URL, tokens
// and the visitor's IP stay on the Next server). Importing this from a Client Component fails the build.
import "server-only";

export { getUser, logIn, renewToken, type Role, type SessionUser } from "./auth";
export { graphql, type GraphqlOptions } from "./client";
export { getLead, getLeads, type LeadsQuery } from "./leads";
export {
  getServiceOptions,
  registerInterest,
  serviceOptionsTtlMs,
  type RegistrationInput,
  type RegistrationResult,
  type ServiceOption,
} from "./registration";
