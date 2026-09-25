"use client";

import { Button } from "@/components/atoms/Button";
import { Alert } from "@/components/molecules/Alert";
import { AppShell } from "@/components/templates/AppShell";

/** An admin page failed on the server, e.g. the API is down. Details stay in the server log. */
export default function AdminError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <AppShell>
      <h1 className="sr-only">Something went wrong</h1>
      <Alert
        tone="error"
        title="We can't load this page right now"
        action={
          // retry() fetches the page again (reset() would only re-render what failed).
          <Button variant="secondary" onClick={() => retry()}>
            Try again
          </Button>
        }
      >
        Something went wrong on our side. Please try again in a moment.
      </Alert>
    </AppShell>
  );
}
