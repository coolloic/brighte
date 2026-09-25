import { Badge, type BadgeProps } from "@/components/atoms/Badge";
import { cn } from "@/lib/cn";

export type ServiceBadgesProps = {
  services: { code: string; label: string }[];
  /** "outline" on a brand-tinted background, where the default brand badges would disappear. */
  tone?: BadgeProps["tone"];
  /** Extra classes for each badge, e.g. to restyle them when their row is hovered. */
  badgeClassName?: string;
  className?: string;
};

/** A lead's services as a labelled list of badges. */
export function ServiceBadges({ services, tone, badgeClassName, className }: ServiceBadgesProps) {
  if (services.length === 0) return <p className={cn("text-sm text-fg-muted", className)}>No services</p>;
  return (
    <ul aria-label="Services" className={cn("flex flex-wrap gap-1.5", className)}>
      {services.map((service) => (
        <li key={service.code}>
          <Badge tone={tone} className={badgeClassName}>
            {service.label}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
