import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormPageTemplate } from "@/components/templates/FormPageTemplate";
import { ApiError } from "@/lib/api/errors";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/sign-in";
import { signInAction } from "./actions";
import { SignIn } from "./_components/SignIn";

export const metadata: Metadata = {
  // The root layout adds " | Brighte Eats" to child routes.
  title: "Admin sign in",
  description: "Sign in to see who has registered interest in Brighte Eats.",
};

export default async function SignInPage({ searchParams }: PageProps<"/admin/login">) {
  const next = safeNext((await searchParams).next);

  // Already signed in as an admin: go straight on. If the API can't be reached, show the form anyway.
  let signedIn = false;
  try {
    signedIn = (await getSession())?.user.role === "ADMIN";
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
  if (signedIn) redirect(next);

  return (
    <FormPageTemplate title="Admin sign in" intro="For Brighte staff: see who has registered interest in Brighte Eats.">
      <SignIn action={signInAction.bind(null, next)} />
    </FormPageTemplate>
  );
}
