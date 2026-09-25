"use server";

import { redirect } from "next/navigation";
import { endSession } from "@/lib/session";

/** Signs out: removes the session cookie and goes to the sign-in page. */
export async function signOutAction() {
  await endSession();
  redirect("/admin/login");
}
