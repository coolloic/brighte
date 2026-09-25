import { errorPayload, sendBrowserReport } from "./lib/send-browser-report";

// Runs in the browser before the app becomes interactive: reports errors nothing else catches. Errors
// React recovers from (a hydration mismatch) arrive here too, through window.reportError. Errors the
// error page catches while rendering are reported by app/error.tsx.

window.addEventListener("error", (event) => {
  sendBrowserReport({
    ...errorPayload("error", event.error ?? event.message),
    source: event.filename || undefined,
    line: event.lineno || undefined,
    column: event.colno || undefined,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  sendBrowserReport(errorPayload("unhandledrejection", event.reason));
});
