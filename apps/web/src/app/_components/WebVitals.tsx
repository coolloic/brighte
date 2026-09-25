"use client";

import { useReportWebVitals } from "next/web-vitals";
import type { WebVitalReport } from "@/lib/browser-reports";
import { sendBrowserReport } from "@/lib/send-browser-report";

// Outside the component, so the callback never changes and no metric is reported twice (Next's guidance).
const report: Parameters<typeof useReportWebVitals>[0] = ({ name, value, rating, id, navigationType }) =>
  sendBrowserReport({ type: "vital", name: name as WebVitalReport["name"], value, rating, id, navigationType });

/** Sends each Web Vital (LCP, INP, CLS, FCP, TTFB) of real visits to the web server's log. Renders nothing. */
export function WebVitals() {
  useReportWebVitals(report);
  return null;
}
