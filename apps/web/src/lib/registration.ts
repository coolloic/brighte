import { messagesByField, registrationSchema } from "@brighte/validation";
import { withoutExample, type RegistrationFeedback, type RegistrationFieldName } from "./api/registration-feedback";

// Shared by the register page's Server Action and its client wrapper (no server-only imports).

export type RegistrationValues = {
  name: string;
  email: string;
  mobile: string;
  postcode: string;
  services: string[];
};

/** What the register Server Action returns: rendered by the form with or without JavaScript. */
export type RegistrationState =
  | { status: "idle" }
  | { status: "success" }
  | ({
      status: "error";
      /** New for every failed submit, so per-attempt UI (the retry countdown) starts over. */
      id: string;
      values: RegistrationValues;
    } & RegistrationFeedback);

/** Reads the form's fields. A Server Action is a public endpoint: anything that isn't a string is dropped. */
export function registrationFromFormData(formData: FormData): RegistrationValues {
  const text = (field: string) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  return {
    name: text("name"),
    email: text("email"),
    mobile: text("mobile"),
    postcode: text("postcode"),
    services: formData.getAll("services").filter((value): value is string => typeof value === "string"),
  };
}

/** The same fields as a native submit sends, so both paths reach the action with the same data. */
export function registrationToFormData(values: RegistrationValues): FormData {
  const formData = new FormData();
  formData.set("name", values.name);
  formData.set("email", values.email);
  formData.set("mobile", values.mobile);
  formData.set("postcode", values.postcode);
  for (const code of values.services) formData.append("services", code);
  return formData;
}

/**
 * Field errors for values the API would reject; empty when the values look valid. The API's own
 * rules (@brighte/validation), checked in the browser before anything is sent: mistakes show at
 * once and never count against the API's rate limit. Not a security boundary: the API validates
 * every request again. Messages drop their examples, which the field hints already show.
 */
export function validateRegistration(values: RegistrationValues): Partial<Record<RegistrationFieldName, string>> {
  const result = registrationSchema.safeParse(values);
  if (result.success) return {};
  const messages = messagesByField(result.error.issues);
  return Object.fromEntries(Object.entries(messages).map(([field, message]) => [field, withoutExample(message)]));
}
