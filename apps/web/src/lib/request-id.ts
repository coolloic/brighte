export const REQUEST_ID_HEADER = "x-request-id";
// Same rule as the API (apps/api/src/common/logging.ts): an id from in front of this server (a load
// balancer's trace id) is kept only if it looks like one, so nobody can write text into the logs.
const VALID_REQUEST_ID = /^[\w-]{8,128}$/;

/** The request's id: the incoming X-Request-Id if valid, a new UUID otherwise. */
export function requestIdFrom(headers: Headers): string {
  const incoming = headers.get(REQUEST_ID_HEADER);
  return incoming && VALID_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
}
