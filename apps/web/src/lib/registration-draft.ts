import type { RegistrationValues } from "./registration";

// What the visitor has typed on the register page, kept in sessionStorage so a reload (by mistake,
// or the browser's own) doesn't lose it. sessionStorage: this tab only, gone when it closes.
// Browser only; every access is guarded, since storage can be disabled or full.

const KEY = "brighte:registration-draft";

/** The saved draft, or undefined when there is none, storage is unavailable, or it isn't a draft. */
export function readRegistrationDraft(): RegistrationValues | undefined {
  try {
    const saved: unknown = JSON.parse(globalThis.sessionStorage.getItem(KEY) ?? "null");
    return isRegistrationValues(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
}

export function saveRegistrationDraft(values: RegistrationValues): void {
  try {
    globalThis.sessionStorage.setItem(KEY, JSON.stringify(values));
  } catch {
    // Unavailable or full: the form works as before, without surviving a reload.
  }
}

export function clearRegistrationDraft(): void {
  try {
    globalThis.sessionStorage.removeItem(KEY);
  } catch {
    // Unavailable: nothing was saved.
  }
}

function isRegistrationValues(value: unknown): value is RegistrationValues {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    ["name", "email", "mobile", "postcode"].every((field) => typeof record[field] === "string") &&
    Array.isArray(record.services) &&
    record.services.every((code) => typeof code === "string")
  );
}
