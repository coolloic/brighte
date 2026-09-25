"use server";

import { registerInterest } from "@/lib/api/registration";
import { registrationFromFormData, type RegistrationState } from "@/lib/registration";

/** Registers interest from the register page's form. The API validates everything. */
export async function registerAction(_previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const values = registrationFromFormData(formData);
  const result = await registerInterest(values);
  if (result.ok) return { status: "success" };
  return { status: "error", values, fieldErrors: result.fieldErrors, alert: result.alert };
}
