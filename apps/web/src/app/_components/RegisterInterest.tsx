"use client";

import { unstable_rethrow } from "next/navigation";
import { startTransition, useActionState, useOptimistic, useState, useSyncExternalStore } from "react";
import { RegistrationForm, type FormAlert } from "@/components/organisms/RegistrationForm";
import type { ServiceOption } from "@/components/molecules/ServicePicker";
import { registerAction } from "@/app/actions";
import { CONNECTION_PROBLEM } from "@/lib/api/registration-feedback";
import {
  registrationFromFormData,
  registrationToFormData,
  validateRegistration,
  type RegistrationState,
  type RegistrationValues,
} from "@/lib/registration";
import { clearRegistrationDraft, readRegistrationDraft, saveRegistrationDraft } from "@/lib/registration-draft";
import { RetryCountdown } from "./RetryCountdown";

const IDLE: RegistrationState = { status: "idle" };

const noSubscription = () => () => {};

/** Whether the values pass the API's rules, checked in the browser (see validateRegistration). */
const isValid = (values: RegistrationValues) => Object.keys(validateRegistration(values)).length === 0;

/**
 * With JavaScript: checks the values in the browser first, and returns any mistakes without sending
 * anything (they show at once and never count against the API's rate limit). Otherwise calls the
 * Server Action, and if the browser can't reach this server (offline, or the request fails),
 * returns an alert instead of throwing, so the form keeps what was typed. Next's own signals (e.g.
 * redirect()) pass through.
 */
async function registerFromBrowser(previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const values = registrationFromFormData(formData);
  const fieldErrors = validateRegistration(values);
  if (Object.keys(fieldErrors).length > 0) return { status: "error", id: crypto.randomUUID(), values, fieldErrors };

  try {
    const result = await registerAction(previous, formData);
    // Registered: nothing left to restore after a reload.
    if (result.status === "success") clearRegistrationDraft();
    return result;
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", id: crypto.randomUUID(), values, alert: CONNECTION_PROBLEM };
  }
}

/**
 * Connects RegistrationForm to the register Server Action. With JavaScript the values are checked
 * in the browser first (validateRegistration), then the confirmation shows at once (optimistic)
 * while the action runs in the background. If the server doesn't confirm (email already
 * registered, rate limited, a lost connection...), the confirmation gives way to the form, with
 * what was typed and the reason. Without JavaScript, the browser posts the form to the same
 * action, the API validates, and the page comes back with the result.
 *
 * What's typed is kept in sessionStorage until the server confirms, so reloading the page (by
 * mistake) brings it back.
 */
export function RegisterInterest({ serviceOptions, renderId }: { serviceOptions: ServiceOption[]; renderId: string }) {
  // Two paths to the same Server Action: `formAction` is the form's own POST (without JavaScript,
  // and it renders that result); `send` is used once JavaScript runs, and survives a lost connection.
  const [postedState, formAction] = useActionState(registerAction, IDLE);
  const [browserState, sendFromBrowser] = useActionState(registerFromBrowser, IDLE);
  // The renderId whose submit is on its way: shows the confirmation until the server answers, then
  // React drops it and the real result shows. Tied to the render, so a navigation meanwhile doesn't
  // carry the confirmation over to the fresh form.
  const [confirmingRenderId, confirmNow] = useOptimistic<string | undefined>(undefined);
  const actionState = browserState.status === "idle" ? postedState : browserState;

  // Navigating to this page again renders it on the server with a new renderId: show a fresh form
  // (empty, or the draft if there is one).
  // useActionState can't be reset, so the result from before the navigation is set aside instead.
  // (Keying this component would break the no-JavaScript submit, which React matches to this hook
  // by the component's position and key.)
  const [seenRenderId, setSeenRenderId] = useState(renderId);
  const [setAside, setSetAside] = useState<RegistrationState>();
  if (renderId !== seenRenderId) {
    setSeenRenderId(renderId);
    setSetAside(actionState);
  }
  const state = actionState === setAside ? IDLE : actionState;

  // The draft from before a reload, read once hydrated (the server can't see sessionStorage, so the
  // first render matches its HTML), and again for each navigation to this page (new renderId).
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const [draft, setDraft] = useState<{ renderId: string; values?: RegistrationValues }>();
  if (hydrated && draft?.renderId !== renderId) setDraft({ renderId, values: readRegistrationDraft() });
  const restored = draft?.renderId === renderId ? draft.values : undefined;

  // Every submit's outcome (mistakes found in the browser, the server's answer) replaces the last one
  // in browserState. The confirmation shows at once only for values the server is expected to take.
  const send = (values: RegistrationValues) =>
    startTransition(() => {
      if (isValid(values)) confirmNow(renderId);
      sendFromBrowser(registrationToFormData(values));
    });

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
      // Remounted after a navigation, so the fields start over too; and once, after hydration, to
      // fill in a restored draft (a form only reads defaultValues when it mounts).
      key={restored ? `${renderId}:restored` : renderId}
      serviceOptions={serviceOptions}
      action={formAction}
      onSubmit={send}
      // No `submitting`: while the action runs, the confirmation is already showing.
      success={confirmingRenderId === renderId || state.status === "success"}
      fieldErrors={error?.fieldErrors}
      formAlert={formAlert}
      // Without JavaScript the page is rendered again after a failed submit: keep what was typed.
      defaultValues={error?.values ?? restored}
      onValuesChange={saveRegistrationDraft}
    />
  );
}
