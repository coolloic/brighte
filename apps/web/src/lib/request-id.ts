export const REQUEST_ID_HEADER = "x-request-id";
// Same rule as the API (apps/api/src/common/logging.ts): an id from in front of this server (a load
// balancer's trace id) is kept only if it looks like one, so nobody can write text into the logs.
const VALID_REQUEST_ID = /^[\w-]{8,128}$/;

/** Whether `value` can be used as a request id. */
export function isRequestId(value: unknown): value is string {
  return typeof value === "string" && VALID_REQUEST_ID.test(value);
}

/** The request's id: the incoming X-Request-Id if valid, a new UUID otherwise. */
export function requestIdFrom(headers: Headers): string {
  const incoming = headers.get(REQUEST_ID_HEADER);
  return isRequestId(incoming) ? incoming : crypto.randomUUID();
}
