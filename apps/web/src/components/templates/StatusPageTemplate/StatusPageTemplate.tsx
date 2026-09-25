import type { ReactNode } from "react";
import { Heading } from "@/components/atoms/Heading";
import { AppShell } from "../AppShell";

export type StatusPageTemplateProps = {
  /** The page's h1, e.g. "Sorry, we can't find that page". */
  title: string;
  /** What to do next, e.g. a "Back to home" link styled as a button. */
  action: ReactNode;
};

/**
 * A page that only says what happened and what to do next (not found, something went wrong), in the
 * style of brighte.com.au's 404: Brighte's yellow pattern with a translucent dark panel on top.
 */
export function StatusPageTemplate({ title, action }: StatusPageTemplateProps) {
  return (
    <AppShell>
      {/* The pattern is decorative, so it's a CSS background. */}
      <div className="flex min-h-[50vh] items-center justify-center rounded-card bg-[url(/images/brighte-pattern-yellow.webp)] bg-cover bg-center p-4 sm:p-8">
        {/* 80% dark with a blur, like Brighte's; white text stays over 8.8:1 on any part of the pattern. */}
        <div className="theme-dark w-full max-w-xl rounded-card bg-surface-inverse/80 px-6 py-10 text-center backdrop-blur-xl sm:px-12">
          <Heading level={1} className="text-fg-inverse">
            {title}
          </Heading>
          <div className="mt-8 flex justify-center">{action}</div>
        </div>
      </div>
    </AppShell>
  );
}
