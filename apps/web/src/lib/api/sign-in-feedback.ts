import type { ApiError } from "./errors";

// What the admin sign-in form shows when signing in fails. Plain data, so a Server Action can return it.

export type SignInAlert = {
  tone: "error" | "warning";
  title: string;
  message: string;
  /** Rate limited: seconds until the next attempt. The page counts it down; `message` is the no-JavaScript fallback. */
  retryAfter?: number;
};

/** A valid account that isn't an admin: the API signs it in, but it can't see leads. */
export const NOT_ADMIN: SignInAlert = {
  tone: "error",
  title: "This account can't view leads",
  message: "Sign in with an admin account.",
};

/** The browser couldn't reach this server (offline, or the request failed). */
export const SIGN_IN_CONNECTION_PROBLEM: SignInAlert = {
  tone: "error",
  title: "We couldn't sign you in",
  message: "Check your connection and try again.",
};

export function signInFeedback(error: ApiError): SignInAlert {
  switch (error.code) {
    case "UNAUTHENTICATED":
      // Same message for an unknown email and a wrong password, like the API: it doesn't reveal which accounts exist.
      return { tone: "error", title: "Email or password is incorrect", message: "Check them and try again." };
    case "TOO_MANY_REQUESTS":
      return {
        tone: "warning",
        title: "Too many attempts",
        message: "Please wait and try again.",
        ...(error.retryAfter && error.retryAfter > 0 && { retryAfter: error.retryAfter }),
      };
    default:
      return {
        tone: "error",
        title: "We couldn't sign you in",
        message: "Something went wrong on our side. Please try again in a moment.",
      };
  }
}
