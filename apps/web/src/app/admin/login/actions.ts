"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { logIn } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { NOT_ADMIN, signInFeedback } from "@/lib/api/sign-in-feedback";
import { startSession } from "@/lib/session";
import { safeNext, signInFromFormData, validateSignIn, type SignInState } from "@/lib/sign-in";

/**
 * Signs an admin in: on success, stores the session cookie and redirects to `next` (an admin path).
 * `next` is bound by the page, but anyone can post any value, so it is checked again here.
 */
export async function signInAction(next: string, _previous: SignInState, formData: FormData): Promise<SignInState> {
  const { email, password } = signInFromFormData(formData);
  // Never send the password back: the form starts empty for it after every failed attempt.
  const fail = (result: Pick<Extract<SignInState, { status: "error" }>, "fieldErrors" | "alert">): SignInState => ({
    status: "error",
    id: randomUUID(),
    email,
    ...result,
  });

  // The browser checks this too; without JavaScript this is the only check before the API.
  const fieldErrors = validateSignIn({ email, password });
  if (Object.keys(fieldErrors).length > 0) return fail({ fieldErrors });

  let session: Awaited<ReturnType<typeof logIn>>;
  try {
    session = await logIn(email.trim(), password);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.code === "NETWORK_ERROR" || error.code === "INTERNAL_SERVER_ERROR") console.error("login failed:", error.message);
    return fail({ alert: signInFeedback(error) });
  }
  if (session.user.role !== "ADMIN") return fail({ alert: NOT_ADMIN });

  await startSession(session.accessToken);
  redirect(safeNext(next));
}
