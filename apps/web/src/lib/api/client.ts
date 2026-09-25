import "server-only";
import { headers } from "next/headers";
import { REQUEST_ID_HEADER } from "../request-id";
import { clientIp } from "./client-ip";
import { ApiError, toApiError } from "./errors";

// A hung API must not hang the page.
const TIMEOUT_MS = 10_000;

export type GraphqlOptions = {
  /** Access token for ADMIN operations, sent as `Authorization: Bearer`. */
  token?: string;
  /** The incoming request's headers, where next/headers isn't available (src/proxy.ts). */
  requestHeaders?: Headers;
};

/**
 * Runs a GraphQL operation against the API and returns its `data`. Throws ApiError for GraphQL
 * errors (with the API's code), an unreachable or slow API (NETWORK_ERROR), or an unreadable
 * response (INTERNAL_SERVER_ERROR).
 *
 * Forwards the visitor's IP in X-Forwarded-For, so the API (with TRUST_PROXY=1) rate-limits each
 * visitor rather than this server, and the page request's id (set by src/proxy.ts) in X-Request-Id,
 * so the API logs the call under the same id. The ApiError carries that id too, for this server's
 * logs. Call it during a request: a Server Component or Server Action.
 */
export async function graphql<T>(query: string, variables: Record<string, unknown> = {}, { token, requestHeaders }: GraphqlOptions = {}): Promise<T> {
  // Only the Next server calls the API (the browser never does), so the URL and tokens stay here.
  const apiUrl = process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 4001}/graphql`;
  // Proxies in front of this Next server whose X-Forwarded-For entries can be trusted (see client-ip.ts).
  const trustedHops = Number(process.env.WEB_TRUST_PROXY ?? 0);
  const incoming = requestHeaders ?? (await headers());
  const visitorIp = clientIp(incoming.get("x-forwarded-for"), trustedHops);
  // Requests src/proxy.ts skips (prefetches) have no id yet: this call gets its own.
  const requestId = incoming.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token && { authorization: `Bearer ${token}` }),
        ...(visitorIp && { "x-forwarded-for": visitorIp }),
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    throw new ApiError("NETWORK_ERROR", `Could not reach the API at ${apiUrl}: ${String(cause)}`, { requestId });
  }

  let json: { data?: T | null; errors?: unknown[] };
  try {
    json = (await response.json()) as typeof json;
  } catch {
    throw new ApiError("INTERNAL_SERVER_ERROR", `The API answered ${response.status} without JSON`, { requestId });
  }

  if (json.errors?.length) throw toApiError(json.errors[0] as Parameters<typeof toApiError>[0], requestId);
  if (json.data == null) throw new ApiError("INTERNAL_SERVER_ERROR", `The API answered ${response.status} without data`, { requestId });
  return json.data;
}
