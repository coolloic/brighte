import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getUser, type SessionUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-cookie";
import { safeNext } from "@/lib/sign-in";

// The admin session is the API's access token in an httpOnly cookie: browser JavaScript can't read
// it, and only this server sends it to the API. It lasts as long as the token (JWT_EXPIRES_IN), and
// src/proxy.ts renews it while the admin is active (up to the API's SESSION_MAX_HOURS).

export async function startSession(accessToken: string) {
  (await cookies()).set(SESSION_COOKIE, accessToken, sessionCookieOptions(accessToken));
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * The signed-in user, checked with the API on each request (cached for the rest of it), or null
 * without a valid session. The cookie alone proves nothing: the API verifies the token.
 */
export const getSession = cache(async (): Promise<{ user: SessionUser; token: string } | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return { user: await getUser(token), token };
  } catch (error) {
    if (error instanceof ApiError && error.code === "UNAUTHENTICATED") return null;
    throw error;
  }
});

/**
 * For every admin page and Server Action: the signed-in admin, or a redirect to sign in (coming
 * back to `returnTo` afterwards).
 */
export async function requireAdmin(returnTo = "/admin"): Promise<{ user: SessionUser; token: string }> {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") redirect(`/admin/login?next=${encodeURIComponent(safeNext(returnTo))}`);
  return session;
}
