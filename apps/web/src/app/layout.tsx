import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
import "./globals.scss";

export const metadata: Metadata = {
  // Makes relative URLs in metadata (canonical, Open Graph) absolute.
  metadataBase: siteUrl(),
  title: { default: "CV coach", template: "%s | CV coach" },
  description: "Check how well your CV matches a job, and tailor it without inventing anything.",
  openGraph: { siteName: "CV coach", locale: "en_AU", type: "website" },
  twitter: { card: "summary" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
