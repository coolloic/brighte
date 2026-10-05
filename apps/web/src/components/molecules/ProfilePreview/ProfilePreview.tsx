import type { ReactNode } from "react";
import { Badge } from "@/components/atoms/Badge";
import type { Profile } from "@/lib/chat";
import { cn } from "@/lib/cn";

export type ProfilePreviewProps = Profile & { className?: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2019" stays "2019", "2019-03" is "Mar 2019", "present" is "Present". */
function formatDate(date: string) {
  if (date === "present") return "Present";
  const [year, month] = date.split("-");
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

function dateRange(start?: string, end?: string) {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return end === "present" ? "Present" : `Until ${formatDate(end)}`;
  return undefined;
}

/** The parts that are there (empty strings from the model count as absent), joined with " · ". */
const join = (parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ");

const link = "text-fg-brand underline underline-offset-2 focus-visible:focus-ring";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 border-t border-border pt-3">
      <h4 className="font-semibold">{title}</h4>
      {children}
    </section>
  );
}

function SkillBadges({ skills, label }: { skills?: string[]; label: string }) {
  if (!skills?.length) return null;
  return (
    <ul aria-label={label} className="mt-2 flex flex-wrap gap-1.5">
      {skills.map((skill, index) => (
        <li key={index}>
          <Badge tone="neutral">{skill}</Badge>
        </li>
      ))}
    </ul>
  );
}

function Highlights({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-1 list-disc space-y-1 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function NewTabLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={link} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * A CV as a structured profile: contact details, then each section the CV has (experience with
 * dates, highlights and skills per role; education; skills; certificates; projects; languages).
 * Empty sections are left out. Presentational: the data was checked by profileBlockSchema.
 */
export function ProfilePreview({ basics, work, education, skills, certificates, projects, languages, className }: ProfilePreviewProps) {
  const location = [basics.location?.city, basics.location?.region, basics.location?.country].filter(Boolean).join(", ");
  const contact = join([location, basics.email, basics.phone]);

  return (
    <article className={cn("my-2 rounded-card border border-border bg-surface p-4 break-words first:mt-0 last:mb-0", className)}>
      <h3 className="text-lead font-semibold">{basics.name}</h3>
      {basics.headline && <p className="mt-1">{basics.headline}</p>}
      {contact && <p className="mt-1 text-sm text-fg-muted">{contact}</p>}
      {basics.links?.length ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {basics.links.map((item, index) => (
            <li key={index}>
              <NewTabLink href={item.url}>{item.label}</NewTabLink>
            </li>
          ))}
        </ul>
      ) : null}

      {basics.summary && (
        <Section title="Summary">
          <p className="mt-1">{basics.summary}</p>
        </Section>
      )}

      {work?.length ? (
        <Section title="Experience">
          <ul className="mt-1 space-y-3">
            {work.map((role, index) => {
              const details = join([role.location, dateRange(role.start, role.end)]);
              return (
                <li key={index}>
                  <p className="font-semibold">
                    {role.position} · {role.employer}
                  </p>
                  {details && <p className="text-sm text-fg-muted">{details}</p>}
                  {role.summary && <p className="mt-1">{role.summary}</p>}
                  <Highlights items={role.highlights} />
                  <SkillBadges skills={role.skills} label={`Skills at ${role.employer}`} />
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {education?.length ? (
        <Section title="Education">
          <ul className="mt-1 space-y-2">
            {education.map((item, index) => {
              const title = [item.qualification, item.field].filter(Boolean).join(", ");
              // An end year alone is when the qualification was completed: "2016", not "Until 2016".
              const dates = item.start ? dateRange(item.start, item.end) : item.end && formatDate(item.end);
              const details = join([dates, item.grade]);
              return (
                <li key={index}>
                  <p className="font-semibold">{title ? `${title} · ${item.institution}` : item.institution}</p>
                  {details && <p className="text-sm text-fg-muted">{details}</p>}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {skills?.length ? (
        <Section title="Skills">
          <ul className="mt-1 space-y-1">
            {skills.map((group, index) => (
              <li key={index}>
                {group.group ? <span className="font-semibold">{group.group}: </span> : null}
                {group.keywords.join(", ")}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {certificates?.length ? (
        <Section title="Certificates">
          <ul className="mt-1 space-y-1">
            {certificates.map((item, index) => (
              <li key={index}>{join([item.name, item.issuer, item.date && formatDate(item.date)])}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {projects?.length ? (
        <Section title="Projects">
          <ul className="mt-1 space-y-3">
            {projects.map((project, index) => (
              <li key={index}>
                <p className="font-semibold">{project.url ? <NewTabLink href={project.url}>{project.name}</NewTabLink> : project.name}</p>
                {project.description && <p className="mt-1">{project.description}</p>}
                <Highlights items={project.highlights} />
                <SkillBadges skills={project.skills} label={`Skills in ${project.name}`} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {languages?.length ? (
        <Section title="Languages">
          <p className="mt-1">{languages.map((item) => (item.fluency ? `${item.language} (${item.fluency})` : item.language)).join(", ")}</p>
        </Section>
      ) : null}
    </article>
  );
}
