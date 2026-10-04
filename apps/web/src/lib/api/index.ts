// Public API of the API layer that is safe anywhere, the browser included: error codes, the copy
// shown for them, and the visitor-IP helper. The operations that call the API are in ./server.

export { clientIp } from "./client-ip";
export { ApiError, toApiError, type ApiErrorCode } from "./errors";
export {
  CONNECTION_PROBLEM,
  formatWait,
  registrationFeedback,
  withoutExample,
  type RegistrationAlert,
  type RegistrationFeedback,
  type RegistrationFieldName,
} from "./registration-feedback";
export { NOT_ADMIN, SIGN_IN_CONNECTION_PROBLEM, signInFeedback, type SignInAlert } from "./sign-in-feedback";
