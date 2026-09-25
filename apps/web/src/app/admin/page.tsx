import type { Metadata } from "next";
import { Text } from "@/components/atoms/Text";
import { AccountMenu } from "@/components/molecules/AccountMenu";
import { DashboardTemplate } from "@/components/templates/DashboardTemplate";
import { requireAdmin } from "@/lib/session";
import { signOutAction } from "./actions";

export const metadata: Metadata = { title: "Leads" };

// The leads dashboard (PR 12 of the frontend plan) replaces this list.
export default async function AdminPage() {
  const { user } = await requireAdmin("/admin");
  return (
    <DashboardTemplate
      title="Leads"
      headerActions={<AccountMenu name={user.name} email={user.email} signOutAction={signOutAction} />}
      list={
        <Text>
          Signed in as {user.name} ({user.email}).
        </Text>
      }
    />
  );
}
