import type { Metadata } from "next";
import { headers } from "next/headers";
import { REQUEST_ID_HEADER } from "@/lib/request-id";
import { siteUrl } from "@/lib/site";
import { WebVitals } from "./_components/WebVitals";
import "./globals.scss";

export const metadata: Metadata = {
  // Makes relative URLs in metadata (canonical, Open Graph) absolute.
  metadataBase: siteUrl(),
  title: { default: "Brighte Eats", template: "%s | Brighte Eats" },
  description: "Brighte Eats: register your interest before launch.",
  openGraph: { siteName: "Brighte Eats", locale: "en_AU", type: "website" },
  twitter: { card: "summary" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Set by src/proxy.ts. Browser reports carry it, so they join the server's log lines for this page.
  const requestId = (await headers()).get(REQUEST_ID_HEADER);
  return (
    <html lang="en-AU" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        {/* React moves it into <head>. */}
        {requestId && <meta name="request-id" content={requestId} />}
        <WebVitals />
        {children}
      </body>
    </html>
  );
}
