import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/atoms/Logo";

export type AppShellProps = {
  /** Right side of the header, e.g. a Sign out button. */
  headerActions?: ReactNode;
  children: ReactNode;
};

/**
 * Page chrome shared by every page: skip link, header with the Brighte Eats wordmark, main landmark
 * (the skip link's target) and footer.
 */
export function AppShell({ headerActions, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg">
      {/* First focusable element: keyboard users can jump past the header. Visible when focused; padding is set there because not-sr-only resets it. */}
      <a
        href="#main"
        className="sr-only z-20 rounded-control bg-surface font-semibold text-fg-brand shadow-card focus-visible:not-sr-only focus-visible:fixed focus-visible:px-4 focus-visible:py-3 focus-visible:top-3 focus-visible:left-3 focus-visible:focus-ring"
      >
        Skip to main content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* The logo is decorative, so the link is named here; the visible "Eats" is part of the name (WCAG 2.5.3). */}
          <Link
            href="/"
            aria-label="Brighte Eats"
            className="flex items-center gap-2 rounded-control text-2xl font-bold tracking-tight text-fg focus-visible:focus-ring md:text-3xl"
          >
            <Logo />
            <span>Eats</span>
          </Link>
          {headerActions}
        </div>
      </header>
      {/* tabIndex -1: the skip link can move focus here. */}
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none sm:px-6 lg:py-12">
        {children}
      </main>
      <footer className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-fg-muted sm:px-6">Brighte Eats: register your interest before launch.</p>
      </footer>
    </div>
  );
}
