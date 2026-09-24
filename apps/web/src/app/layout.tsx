import type { Metadata } from "next";
import "./globals.scss";

export const metadata: Metadata = {
  title: "Brighte",
  description: "Brighte monorepo web app",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
