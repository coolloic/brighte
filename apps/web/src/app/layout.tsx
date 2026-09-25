import type { Metadata } from "next";
import "./globals.scss";

export const metadata: Metadata = {
  title: { default: "Brighte Eats", template: "%s | Brighte Eats" },
  description: "Brighte Eats: register your interest before launch.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
