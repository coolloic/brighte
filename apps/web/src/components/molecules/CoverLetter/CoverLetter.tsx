import type { ReactNode } from "react";
import type { CoverLetterBlock, Profile } from "@/lib/chat";
import { cn } from "@/lib/cn";

export type CoverLetterProps = CoverLetterBlock & {
  /** Who it's from: the name and contact details at the top and the name it's signed with, from the profile. */
  sender: Profile["basics"];
  /** Under the heading, e.g. the chat's PDF buttons. */
  actions?: ReactNode;
  className?: string;
};

/**
 * A cover letter for one job, laid out as it prints: the sender's name and contact details (from the
 * profile), who it's to, the greeting, the paragraphs and the sign-off. Presentational.
 */
export function CoverLetter({ job, recipient, greeting, paragraphs, closing, sender, actions, className }: CoverLetterProps) {
  const location = [sender.location?.city, sender.location?.region, sender.location?.country].filter(Boolean).join(", ");
  const contact = [location, sender.email, sender.phone].filter(Boolean).join(" · ");
  const to = [recipient, job.employer].filter(Boolean);
  return (
    <article className={cn("my-2 rounded-card border border-border bg-surface p-4 break-words first:mt-0 last:mb-0", className)}>
      <h3 className="text-lead font-semibold">{job.employer ? `Cover letter for ${job.title} · ${job.employer}` : `Cover letter for ${job.title}`}</h3>

      {actions}

      <div className="mt-3 space-y-3 border-t border-border pt-3">
        <div>
          <p className="font-semibold text-fg-brand">{sender.name}</p>
          {contact && <p className="text-sm text-fg-muted">{contact}</p>}
        </div>
        {to.length > 0 && (
          <p>
            {to.map((line, index) => (
              <span key={index} className="block">
                {line}
              </span>
            ))}
          </p>
        )}
        <p>{greeting}</p>
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        <p>
          {closing}
          <span className="block font-semibold">{sender.name}</span>
        </p>
      </div>
    </article>
  );
}
