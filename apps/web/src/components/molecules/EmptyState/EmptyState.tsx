import type { ReactNode } from "react";
import { Heading } from "@/components/atoms/Heading";
import { Icon, type IconName } from "@/components/atoms/Icon";
import { Text } from "@/components/atoms/Text";

export type EmptyStateProps = {
  title: string;
  message?: string;
  /** Heading level that fits the page's outline (default 2). */
  headingLevel?: 2 | 3 | 4;
  icon?: IconName;
  /** e.g. a link to clear the filter. */
  action?: ReactNode;
};

/** Shown instead of a list that has nothing in it, with what to do next. */
export function EmptyState({ title, message, headingLevel = 2, icon = "info", action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong px-6 py-10 text-center">
      <Icon name={icon} className="size-8 text-fg-muted" />
      <Heading level={headingLevel} size="md">
        {title}
      </Heading>
      {message && (
        <Text tone="muted" className="max-w-prose">
          {message}
        </Text>
      )}
      {action}
    </div>
  );
}
