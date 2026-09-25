import { NextResponse, type NextRequest } from "next/server";
import { renewToken } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { SESSION_COOKIE, sessionCookieOptions, shouldRenew } from "@/lib/session-cookie";

/**
 * Sliding admin sessions. On admin requests, a session token with under 10 minutes left is swapped
 * for a fresh one (the API's renewToken), so an active admin stays signed in. An idle one's token
 * expires (JWT_EXPIRES_IN, 30 min) and can't be renewed, and the API stops renewals SESSION_MAX_HOURS
 * (8) after signing in.
 *
 * Not an access check: pages and Server Actions call requireAdmin(), which asks the API.
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !shouldRenew(token)) return NextResponse.next();

  let fresh: string;
  try {
    fresh = await renewToken(token, request.headers);
  } catch (error) {
    // Refused (session over) or API down: carry on, and the page signs the admin out or shows the error page.
    if (error instanceof ApiError) return NextResponse.next();
    throw error;
  }
  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, fresh, sessionCookieOptions(fresh));
  return response;
}

export const config = {
  // Admin pages and their Server Actions (Server Actions are POSTs to the page's route).
  matcher: "/admin/:path*",
};
