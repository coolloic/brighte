import { randomInt, randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// Shared by the e2e specs.

// Seed accounts (pnpm db:seed); passwords from apps/api/.env, loaded by playwright.config.ts.
export const ADMIN = { email: "admin@brighte.dev", password: process.env.SEED_ADMIN_PASSWORD ?? "admin-dev-password" };
export const USER = { email: "user@brighte.dev", password: process.env.SEED_USER_PASSWORD ?? "user-dev-password" };

/** A random visitor IP for X-Forwarded-For, so tests don't share rate limits (see playwright.config.ts). */
export const visitorIp = () => `198.${randomInt(18, 20)}.${randomInt(256)}.${randomInt(1, 255)}`;

/** Filtered by text: Next's route announcer is a role="alert" element too. */
export const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });

/** Fills in and submits the admin sign-in form. The password field is found by a label starting with "Password" (not its "Show password" button). */
export async function signIn(page: Page, { email, password }: { email: string; password: string }) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs in as the admin from the sign-in page, then goes to `path`. */
export async function signInAsAdmin(page: Page, path = "/admin") {
  await page.goto(`/admin/login?next=${encodeURIComponent(path)}`);
  await signIn(page, ADMIN);
  await expect(page).toHaveURL(path);
}

/** Registers a lead straight through the e2e API (each from its own visitor IP) and returns it. */
export async function registerLead(overrides: { name?: string; services?: string[] } = {}) {
  const lead = {
    name: overrides.name ?? `E2E ${randomUUID().slice(0, 8)}`,
    email: `e2e-${randomUUID()}@example.com`,
    mobile: "0412345678",
    postcode: "2000",
    services: overrides.services ?? ["pick-up"],
  };
  const response = await fetch(process.env.E2E_API_URL!, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": visitorIp() },
    body: JSON.stringify({
      query: `mutation ($name: String!, $email: String!, $mobile: String!, $postcode: String!, $services: [String!]!) {
        register(name: $name, email: $email, mobile: $mobile, postcode: $postcode, services: $services) { id }
      }`,
      variables: lead,
    }),
  });
  const body = (await response.json()) as { data?: { register: { id: string } }; errors?: unknown };
  if (!body.data) throw new Error(`register failed: ${JSON.stringify(body.errors)}`);
  return { ...lead, id: body.data.register.id };
}
