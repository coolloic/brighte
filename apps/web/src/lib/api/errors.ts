// Error codes from the API (`extensions.code`), plus NETWORK_ERROR when the API could not be reached
// or took too long. Code branches on `code`, never on `message`.
export type ApiErrorCode =
  | "BAD_USER_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_SERVER_ERROR"
  | "NETWORK_ERROR";

const KNOWN_CODES = new Set<string>([
  "BAD_USER_INPUT",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "CONFLICT",
  "TOO_MANY_REQUESTS",
  "INTERNAL_SERVER_ERROR",
  "NETWORK_ERROR",
]);

/** A failed API call. Server-side only: map it to user-facing copy before it reaches a component. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** BAD_USER_INPUT: a message per invalid argument, e.g. `{ mobile: "Enter an Australian mobile number…" }`. */
  readonly fields?: Record<string, string>;
  /** TOO_MANY_REQUESTS: seconds until the limit resets. */
  readonly retryAfter?: number;

  constructor(code: ApiErrorCode, message: string, details: { fields?: Record<string, string>; retryAfter?: number } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fields = details.fields;
    this.retryAfter = details.retryAfter;
  }
}

type GraphQLErrorJson = { message?: unknown; extensions?: { code?: unknown; fields?: unknown; retryAfter?: unknown } };

/** Turns the first error of a GraphQL response into an ApiError. Unknown codes count as INTERNAL_SERVER_ERROR. */
export function toApiError(error: GraphQLErrorJson): ApiError {
  const { code, fields, retryAfter } = error.extensions ?? {};
  const message = typeof error.message === "string" ? error.message : "Unknown API error";
  return new ApiError(typeof code === "string" && KNOWN_CODES.has(code) ? (code as ApiErrorCode) : "INTERNAL_SERVER_ERROR", message, {
    fields: isStringRecord(fields) ? fields : undefined,
    retryAfter: typeof retryAfter === "number" ? retryAfter : undefined,
  });
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && Object.values(value).every((v) => typeof v === "string");
}
