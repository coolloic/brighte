"use client";

import ErrorPage from "./error";
// global-error replaces the root layout, styles included.
import "./globals.scss";

/**
 * A failure in the root layout itself, which app/error.tsx sits inside and can't catch: the same page,
 * in its own document (the <html> and <body> of app/layout.tsx).
 */
export default function GlobalError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en-AU" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <title>Something went wrong | Brighte Eats</title>
        <ErrorPage {...props} />
      </body>
    </html>
  );
}
