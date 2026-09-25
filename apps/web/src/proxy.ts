import { NextResponse, type NextRequest } from "next/server";
import { renewToken } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { contentSecurityPolicy, STRICT_TRANSPORT_SECURITY } from "@/lib/security-headers";
import { SESSION_COOKIE, sessionCookieOptions, shouldRenew } from "@/lib/session-cookie";
import { siteUrl } from "@/lib/site";

/**
 * Runs before every page:
 * 1. A Content-Security-Policy with a fresh nonce. Next reads it from the request's CSP header and
 *    adds the nonce to its own scripts; every page is rendered per request, which this needs.
 * 2. Sliding admin sessions (on /admin only): a session token with under 10 minutes left is
 *    swapped for a fresh one (the API's renewToken), so an active admin stays signed in. An idle
 *    one's token expires (JWT_EXPIRES_IN, 30 min) and can't be renewed, and the API stops renewals
 *    SESSION_MAX_HOURS (8) after signing in. Not an access check: pages and Server Actions call
 *    requireAdmin(), which asks the API.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const https = siteUrl().protocol === "https:";
  const policy = contentSecurityPolicy({ nonce, development: process.env.NODE_ENV === "development", https });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  if (https) response.headers.set("Strict-Transport-Security", STRICT_TRANSPORT_SECURITY);

  if (request.nextUrl.pathname.startsWith("/admin")) await renewSession(request, response);
  return response;
}

async function renewSession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !shouldRenew(token)) return;
  try {
    const fresh = await renewToken(token, request.headers);
    response.cookies.set(SESSION_COOKIE, fresh, sessionCookieOptions(fresh));
  } catch (error) {
    // Refused (session over) or API down: carry on, and the page signs the admin out or shows the error page.
    if (!(error instanceof ApiError)) throw error;
  }
}

export const config = {
  matcher: [
    {
      // Every page and Server Action, not static files. Prefetches are skipped (Next's CSP guidance):
      // they're data for a later navigation, which runs this itself.
      source: "/((?!_next/static|_next/image|images/|icon.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
