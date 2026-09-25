"use client";

import { unstable_rethrow } from "next/navigation";
import { startTransition, useActionState, useState } from "react";
import { SignInForm, type SignInFormAlert } from "@/components/organisms/SignInForm";
import { RetryCountdown } from "@/app/_components/RetryCountdown";
import { SIGN_IN_CONNECTION_PROBLEM } from "@/lib/api/sign-in-feedback";
import { signInFromFormData, signInToFormData, validateSignIn, type SignInState, type SignInValues } from "@/lib/sign-in";

const IDLE: SignInState = { status: "idle" };

type SignInAction = (state: SignInState, formData: FormData) => Promise<SignInState>;

/**
 * Connects SignInForm to the sign-in Server Action (bound to where to go next). With JavaScript the
 * values are checked in the browser first, and a lost connection shows an alert and keeps the email
 * (the redirect after signing in passes through). Without it, the browser posts to the same action.
 */
export function SignIn({ action }: { action: SignInAction }) {
  // The form's own POST (without JavaScript), and the path used once JavaScript runs.
  const [postedState, formAction] = useActionState(action, IDLE);
  const [browserState, sendFromBrowser, submitting] = useActionState<SignInState, FormData>(async (previous, formData) => {
    try {
      return await action(previous, formData);
    } catch (error) {
      unstable_rethrow(error);
      return { status: "error", id: crypto.randomUUID(), email: signInFromFormData(formData).email, alert: SIGN_IN_CONNECTION_PROBLEM };
    }
  }, IDLE);
  const state = browserState.status === "idle" ? postedState : browserState;
  const [browserErrors, setBrowserErrors] = useState<ReturnType<typeof validateSignIn>>();

  const submit = (values: SignInValues) => {
    const errors = validateSignIn(values);
    if (Object.keys(errors).length > 0) {
      setBrowserErrors(errors);
      return;
    }
    setBrowserErrors(undefined);
    startTransition(() => sendFromBrowser(signInToFormData(values)));
  };

  const error = state.status === "error" ? state : undefined;
  const alert: SignInFormAlert | undefined =
    !browserErrors && error?.alert
      ? {
          tone: error.alert.tone,
          title: error.alert.title,
          message: error.alert.retryAfter ? <RetryCountdown key={error.id} seconds={error.alert.retryAfter} /> : error.alert.message,
        }
      : undefined;

  return (
    <SignInForm
      // A fresh form for every failed attempt, so the password starts empty.
      key={error?.id ?? "idle"}
      action={formAction}
      onSubmit={submit}
      submitting={submitting}
      fieldErrors={browserErrors ?? error?.fieldErrors}
      alert={alert}
      defaultEmail={error?.email}
    />
  );
}
