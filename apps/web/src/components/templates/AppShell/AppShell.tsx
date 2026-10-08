import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/atoms/Logo";
import { cn } from "@/lib/cn";

export type AppShellProps = {
  /** Right side of the header, e.g. a Sign out button. */
  headerActions?: ReactNode;
  /** On desktop (lg and up), header, content and footer span 90% of the screen instead of 1152px, e.g. for the chat. */
  wide?: boolean;
  children: ReactNode;
};

/**
 * Page chrome shared by every page: skip link, header with the CV coach wordmark, main landmark
 * (the skip link's target) and footer.
 */
export function AppShell({ headerActions, wide = false, children }: AppShellProps) {
  // The same width for header, main and footer, so their edges line up.
  const width = cn("max-w-6xl", wide && "lg:max-w-[90vw]");
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
        <div className={cn("mx-auto flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6", width)}>
          {/* The mark is decorative: the visible text names the link. */}
          <Link
            href="/"
            className="flex items-center gap-2 rounded-control text-2xl font-bold tracking-tight text-fg focus-visible:focus-ring md:text-3xl"
          >
            <Logo />
            <span>CV coach</span>
          </Link>
          {headerActions}
        </div>
      </header>
      {/* tabIndex -1: the skip link can move focus here. */}
      <main id="main" tabIndex={-1} className={cn("mx-auto w-full flex-1 px-4 py-8 focus:outline-none sm:px-6 lg:py-12", width)}>
        {children}
      </main>
      <footer className="border-t border-border">
        <p className={cn("mx-auto px-4 py-6 text-sm text-fg-muted sm:px-6", width)}>CV coach: match your CV to a job, then tailor it.</p>
      </footer>
    </div>
  );
}
