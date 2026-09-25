"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PageSizeSelect } from "@/components/molecules/PageSizeSelect";
import { dashboardHref, PAGE_SIZES, type DashboardParams, type PageSize } from "@/lib/dashboard";

/** "Per page" for the leads list: the choice applies at once and goes back to page 1. */
export function PageSizeControl({ params }: { params: DashboardParams }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { q, service, sort, lead } = params;
  return (
    <PageSizeSelect
      value={params.size}
      options={PAGE_SIZES}
      onChange={(size) => startTransition(() => router.push(dashboardHref({ q, service, sort, lead, size: size as PageSize }), { scroll: false }))}
      action="/admin"
      hiddenFields={{ q, service, sort }}
    />
  );
}
