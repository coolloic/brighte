import type { Metadata } from "next";

// Admin pages are for Brighte staff: keep them out of search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
