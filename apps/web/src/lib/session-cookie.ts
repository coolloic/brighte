// The admin session cookie: its name, options and when to renew it. Shared by src/lib/session.ts
// and src/proxy.ts (which renews an active session's token before it expires).

export const SESSION_COOKIE = "brighte_session";

/** Renew when the token has less than this left. Tokens last JWT_EXPIRES_IN (30 min by default). */
export const RENEW_WITHIN_SECONDS = 10 * 60;

/** When the token expires, from its `exp` claim (not verified here: the API does that). */
export function tokenExpiry(token: string): Date | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" ? new Date(payload.exp * 1000) : undefined;
  } catch {
    return undefined;
  }
}

/** A still-valid token close to expiry. Expired or unreadable tokens are left alone: the page sends those to sign in. */
export function shouldRenew(token: string, now = Date.now()): boolean {
  const expiry = tokenExpiry(token)?.getTime();
  return expiry !== undefined && expiry > now && expiry - now < RENEW_WITHIN_SECONDS * 1000;
}

/** httpOnly (JavaScript can't read it), SameSite=Lax, Secure in production, expiring with the token. */
export function sessionCookieOptions(token: string) {
  return {
    httpOnly: true,
    // Browsers also accept Secure cookies from http://localhost, so this holds for local production builds.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: tokenExpiry(token),
  };
}
