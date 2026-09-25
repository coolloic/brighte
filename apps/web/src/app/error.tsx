"use client";

import { useEffect } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { StatusPageTemplate } from "@/components/templates/StatusPageTemplate";
import { errorPayload, sendBrowserReport } from "@/lib/send-browser-report";

/**
 * Any page that fails: the API is down, or the browser lost its connection to this server mid-way.
 * Details stay in the server log; the reference shown is the error's digest, which
 * src/instrumentation.ts logs with them, so support can find them. An error without a digest was
 * thrown in the browser, which the server never saw: it is reported from here. retry() fetches the
 * page again (reset() would only re-render it).
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    if (!error.digest) sendBrowserReport(errorPayload("boundary", error));
  }, [error]);

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
