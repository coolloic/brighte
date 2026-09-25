import type { ReactNode } from "react";
import { Heading } from "@/components/atoms/Heading";
import { Icon } from "@/components/atoms/Icon";
import { Text } from "@/components/atoms/Text";
import { AppShell } from "../AppShell";

export type FormPageTemplateProps = {
  /** The page's h1. */
  title: string;
  intro: string;
  /** Reasons to register, shown as a ticked list beside the form from lg up. */
  highlights?: string[];
  /** The form, e.g. <RegistrationForm />. */
  children: ReactNode;
};

/** Mobile: title, intro, form. From lg: headline, intro and highlights on the left; the form in a card on the right. */
export function FormPageTemplate({ title, intro, highlights = [], children }: FormPageTemplateProps) {
  return (
    <AppShell>
      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,32rem)] lg:gap-16">
        <div className="lg:pt-6">
          <Heading level={1}>{title}</Heading>
          <Text size="lg" tone="muted" className="mt-3 max-w-prose">
            {intro}
          </Text>
          {highlights.length > 0 && (
            <ul className="mt-6 hidden space-y-3 lg:block">
              {highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-3 text-fg">
                  <Icon name="check-circle" className="mt-0.5 text-fg-brand" />
                  {highlight}
                </li>
              ))}
            </ul>
          )}
        </div>
        <section aria-label={title} className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-8">
          {children}
        </section>
      </div>
    </AppShell>
  );
}
