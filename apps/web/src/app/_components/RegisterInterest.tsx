"use client";

import { startTransition, useActionState, useState } from "react";
import { RegistrationForm, type FormAlert } from "@/components/organisms/RegistrationForm";
import type { ServiceOption } from "@/components/molecules/ServicePicker";
import { registerAction } from "@/app/actions";
import { registrationToFormData, validateRegistration, type RegistrationState, type RegistrationValues } from "@/lib/registration";
import { RetryCountdown } from "./RetryCountdown";

const IDLE: RegistrationState = { status: "idle" };

/**
 * Connects RegistrationForm to the register Server Action. With JavaScript the values are checked
 * in the browser first (validateRegistration), then the action runs in the background while the
 * form stays on the page. Without it, the browser posts the form to the same action, the API
 * validates, and the page comes back with the result.
 */
export function RegisterInterest({ serviceOptions, renderId }: { serviceOptions: ServiceOption[]; renderId: string }) {
  const [actionState, formAction, submitting] = useActionState(registerAction, IDLE);

  // Navigating to this page again renders it on the server with a new renderId: show a fresh form.
  // useActionState can't be reset, so the result from before the navigation is set aside instead.
  // (Keying this component would break the no-JavaScript submit, which React matches to this hook
  // by the component's position and key.)
  const [seenRenderId, setSeenRenderId] = useState(renderId);
  const [setAside, setSetAside] = useState<RegistrationState>();
  // Mistakes caught in the browser: shown instead of the last server result, and nothing is sent.
  const [browserErrors, setBrowserErrors] = useState<ReturnType<typeof validateRegistration>>();
  if (renderId !== seenRenderId) {
    setSeenRenderId(renderId);
    setSetAside(actionState);
    setBrowserErrors(undefined);
  }
  const state = actionState === setAside ? IDLE : actionState;

  const send = (values: RegistrationValues) => startTransition(() => formAction(registrationToFormData(values)));
  const submit = (values: RegistrationValues) => {
    const errors = validateRegistration(values);
    if (Object.keys(errors).length > 0) {
      setBrowserErrors(errors);
      return;
    }
    setBrowserErrors(undefined);
    send(values);
  };

  const error = state.status === "error" ? state : undefined;
  const formAlert: FormAlert | undefined = error?.alert && {
    tone: error.alert.tone,
    title: error.alert.title,
    // Rate limited: count down in the browser (a new countdown for each attempt).
    message: error.alert.retryAfter ? <RetryCountdown key={error.id} seconds={error.alert.retryAfter} /> : error.alert.message,
    onRetry: error.alert.retryable ? () => send(error.values) : undefined,
  };

  return (
    <RegistrationForm
      // Remounted after a navigation, so the fields start empty too.
      key={renderId}
      serviceOptions={serviceOptions}
      action={formAction}
      onSubmit={submit}
      submitting={submitting}
      success={state.status === "success"}
      fieldErrors={browserErrors ?? error?.fieldErrors}
      formAlert={browserErrors ? undefined : formAlert}
      // Without JavaScript the page is rendered again after a failed submit: keep what was typed.
      defaultValues={error?.values}
    />
  );
}
