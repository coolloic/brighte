import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
import "./globals.scss";

export const metadata: Metadata = {
  // Makes relative URLs in metadata (canonical, Open Graph) absolute.
  metadataBase: siteUrl(),
  title: { default: "Brighte Eats", template: "%s | Brighte Eats" },
  description: "Brighte Eats: register your interest before launch.",
  openGraph: { siteName: "Brighte Eats", locale: "en_AU", type: "website" },
  twitter: { card: "summary" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
