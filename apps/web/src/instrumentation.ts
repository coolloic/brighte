import type { Instrumentation } from "next";
import { errorFields, log } from "./lib/log";
import { REQUEST_ID_HEADER } from "./lib/request-id";

/**
 * Every error the Next server catches (a Server Component, Server Action or the proxy), as one
 * JSON line. `digest` is the reference app/error.tsx shows the visitor. `requestId` is the page
 * request's id, which its API calls were sent with; for an ApiError, the id of that call (the same,
 * unless src/proxy.ts skipped the request) and its `code`. Errors that pages handle themselves (a
 * failed login, the API down on the register page) are logged where they're handled.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  const requestId = request.headers[REQUEST_ID_HEADER];
  log.error("Request failed", {
    requestId,
    ...errorFields(error),
    digest,
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
