import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { buttonVariants } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { StatusPageTemplate } from "@/components/templates/StatusPageTemplate";

// The root layout adds " | Brighte Eats".
export const metadata: Metadata = { title: "Page not found" };

/**
 * Any URL that doesn't match a page (HTTP 404). Rendered per request, like every page: the CSP
 * nonce (src/proxy.ts) only reaches scripts at request time, and a prerendered 404 would be blocked.
 */
export default async function NotFound() {
  await connection();
  return (
    <StatusPageTemplate
      title="Sorry, we can't find that page"
      action={
        <Link href="/" className={buttonVariants()}>
          Back to home
          <Icon name="chevron-right" />
        </Link>
      }
    />
  );
}
