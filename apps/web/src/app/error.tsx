"use client";

import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { StatusPageTemplate } from "@/components/templates/StatusPageTemplate";

/**
 * Any page that fails: the API is down, or the browser lost its connection to this server mid-way.
 * Details stay in the server log; the reference shown is the error's digest, which
 * src/instrumentation.ts logs with them, so support can find them. retry() fetches the page again
 * (reset() would only re-render it).
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <StatusPageTemplate
      title="Something went wrong, please try again later"
      reference={error.digest}
      action={
        <Button onClick={() => retry()}>
          Try again
          <Icon name="chevron-right" />
        </Button>
      }
    />
  );
}
