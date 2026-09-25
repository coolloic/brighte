import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getUser, type SessionUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { safeNext } from "@/lib/sign-in";

// The admin session is the API's access token in an httpOnly cookie: browser JavaScript can't read
// it, and only this server sends it to the API. It lasts as long as the token (JWT_EXPIRES_IN).
const SESSION_COOKIE = "brighte_session";

export async function startSession(accessToken: string) {
  (await cookies()).set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    // Browsers also accept Secure cookies from http://localhost, so this holds for local production builds.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: tokenExpiry(accessToken),
  });
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

/** When the token expires, from its `exp` claim (not verified here: the API does that). Undefined: a browser-session cookie. */
function tokenExpiry(token: string): Date | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" ? new Date(payload.exp * 1000) : undefined;
  } catch {
    return undefined;
  }
}
