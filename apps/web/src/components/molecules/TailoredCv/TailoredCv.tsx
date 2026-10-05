import { Icon } from "@/components/atoms/Icon";
import { ProfilePreview } from "@/components/molecules/ProfilePreview";
import type { TailoredBlock, TailorFlag, TailorResult } from "@/lib/chat";
import { cn } from "@/lib/cn";

export type TailoredCvProps = TailorResult & { job: TailoredBlock["job"]; className?: string };

function FlagList({ title, flags, tone }: { title: string; flags: TailorFlag[]; tone: "danger" | "warning" }) {
  if (flags.length === 0) return null;
  return (
    <div className="mt-2">
      <p className={cn("text-sm font-semibold", tone === "danger" ? "text-danger" : "text-warning")}>{title}</p>
      <ul aria-label={title} className="mt-1 space-y-1">
        {flags.map((flag, index) => (
          <li key={index} className="flex gap-2">
            <Icon name="alert-circle" className={cn("mt-0.5 size-4", tone === "danger" ? "text-danger" : "text-warning")} />
            {/* min-w-0: a flex item won't shrink below its longest word otherwise, and long text must wrap. */}
            <span className="min-w-0">{flag.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A CV tailored to one job: what to check (blocking first), the CV as it would be downloaded, and the
 * changes to review (each reworded bullet with its original, and what was left out). Presentational:
 * the data comes from tailorCv, which takes every fact from the profile.
 */
export function TailoredCv({ job, cv, flags, reworded, leftOut, className }: TailoredCvProps) {
  const blocking = flags.filter((flag) => flag.level === "blocking");
  const warnings = flags.filter((flag) => flag.level === "warning");
  const leftOutGroups: [string, string[]][] = [
    ["Roles", leftOut.roles],
    ["Bullets", leftOut.bullets.map((bullet) => `${bullet.where}: ${bullet.text}`)],
    ["Projects", leftOut.projects],
    ["Education", leftOut.education],
    ["Certificates", leftOut.certificates],
    ["Languages", leftOut.languages],
  ].filter((group): group is [string, string[]] => group[1].length > 0);
  const leftOutCount = leftOutGroups.reduce((total, [, items]) => total + items.length, 0);

  return (
    <article className={cn("my-2 rounded-card border border-border bg-surface p-4 break-words first:mt-0 last:mb-0", className)}>
      <h3 className="text-lead font-semibold">{job.employer ? `Tailored for ${job.title} · ${job.employer}` : `Tailored for ${job.title}`}</h3>

      {flags.length > 0 && (
        <section className="mt-3 rounded-control border border-border bg-surface-muted p-3">
          <h4 className="font-semibold">{flags.length === 1 ? "1 thing to check" : `${flags.length} things to check`}</h4>
          <FlagList title="Fix before downloading" flags={blocking} tone="danger" />
          <FlagList title="Worth a look" flags={warnings} tone="warning" />
        </section>
      )}

      <ProfilePreview {...cv} className="mt-3 border-0 p-0" />

      <details className="group mt-3 border-t border-border pt-3">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
          Review changes: {reworded.length} reworded · {leftOutCount} left out
          <Icon name="chevron-down" className="size-4 group-open:rotate-180 motion-safe:transition-transform" />
        </summary>
        {reworded.length > 0 && (
          <section className="mt-2">
            <h4 className="font-semibold">Reworded</h4>
            <ul className="mt-1 space-y-2">
              {reworded.map((bullet, index) => (
                <li key={index}>
                  <p>{bullet.text}</p>
                  {bullet.originals.length === 0 ? (
                    <p className="text-sm text-fg-muted">No original in your profile.</p>
                  ) : (
                    bullet.originals.map((original, i) => (
                      <p key={i} className="text-sm text-fg-muted">
                        Original: {original}
                      </p>
                    ))
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {leftOutGroups.length > 0 && (
          <section className="mt-3">
            <h4 className="font-semibold">Left out</h4>
            {leftOutGroups.map(([label, items]) => (
              <div key={label} className="mt-1">
                <p className="text-sm font-semibold">{label}</p>
                <ul className="list-disc pl-5 text-sm">
                  {items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </details>
    </article>
  );
}
