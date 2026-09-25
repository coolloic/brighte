import type { ApiError } from "./errors";

// What the register page shows for a failed registration. Kept as plain data (no functions) so a
// Server Action can return it to the form. Structurally matches RegistrationForm's props.

export type RegistrationFieldName = "name" | "email" | "mobile" | "postcode" | "services";

export type RegistrationAlert = {
  tone: "error" | "warning";
  title: string;
  message: string;
  /** Show "Try again": resubmitting the same values may work (e.g. the API was briefly down). */
  retryable: boolean;
  /** Rate limited: seconds until the visitor can try again. The page counts it down; `message` is the no-JavaScript fallback. */
  retryAfter?: number;
};

export type RegistrationFeedback = {
  fieldErrors?: Partial<Record<RegistrationFieldName, string>>;
  alert?: RegistrationAlert;
};

/** The browser couldn't reach this server (offline, or the request failed): the form keeps what was typed. */
export const CONNECTION_PROBLEM: RegistrationAlert = {
  tone: "error",
  title: "We couldn't send your registration",
  message: "Check your connection and try again. Your details are still here.",
  retryable: true,
};

const FIELDS = new Set<string>(["name", "email", "mobile", "postcode", "services"]);

/** Maps an API error from `register` to messages next to the fields, or one alert above the form. */
export function registrationFeedback(error: ApiError): RegistrationFeedback {
  switch (error.code) {
    case "BAD_USER_INPUT": {
      const entries = Object.entries(error.fields ?? {}).filter(([field]) => FIELDS.has(field));
      if (entries.length === 0) {
        return {
          alert: {
            tone: "error",
            title: "Some details weren't accepted",
            message: "Check the form and try again.",
            retryable: false,
          },
        };
      }
      return { fieldErrors: Object.fromEntries(entries.map(([field, message]) => [field, withoutExample(message)])) };
    }
    case "CONFLICT":
      return { fieldErrors: { email: "This email has already registered interest. Use a different email." } };
    case "TOO_MANY_REQUESTS":
      return {
        alert: {
          tone: "warning",
          title: "Too many attempts",
          message: `Please wait ${formatWait(error.retryAfter)} and try again.`,
          retryable: false,
          ...(error.retryAfter && error.retryAfter > 0 && { retryAfter: error.retryAfter }),
        },
      };
    default:
      // NETWORK_ERROR, INTERNAL_SERVER_ERROR, and anything unexpected for a public operation.
      return {
        alert: {
          tone: "error",
          title: "We couldn't send your registration",
          message: "Something went wrong on our side. Your details are still here, so please try again.",
          retryable: true,
        },
      };
  }
}

// The form shows an example under each field as a hint, so an error doesn't repeat it:
// "Enter an Australian mobile number, e.g. 0412 345 678" becomes "Enter an Australian mobile number".
export function withoutExample(message: string): string {
  return message.replace(/,?\s*e\.g\..*$/, "");
}

/** "45 seconds", "1 minute", "2 minutes 5 seconds". Unknown: "a minute" (the API's base block). */
export function formatWait(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "a minute";
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return plural(rest, "second");
  return rest === 0 ? plural(minutes, "minute") : `${plural(minutes, "minute")} ${plural(rest, "second")}`;
}
