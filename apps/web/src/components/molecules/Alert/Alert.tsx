import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/atoms/Icon";
import { cn } from "@/lib/cn";

export type AlertTone = "error" | "success" | "info" | "warning";

// Tinted banner with a tone-colored border; the text colors are WCAG AAA on each tint.
const alertVariants = cva("flex items-start gap-3 rounded-control border p-4 text-fg", {
  variants: {
    tone: {
      error: "border-danger bg-danger-surface",
      success: "border-success bg-success-surface",
      info: "border-info bg-info-surface",
      warning: "border-warning bg-warning-surface",
    },
  },
});

const toneText: Record<AlertTone, string> = { error: "text-danger", success: "text-success", info: "text-info", warning: "text-warning" };
const toneIcon: Record<AlertTone, IconName> = { error: "alert-circle", success: "check-circle", info: "info", warning: "alert-circle" };

export type AlertProps = {
  tone: AlertTone;
  title: string;
  children?: ReactNode;
  /** e.g. a Retry button: use <Button variant="secondary">, so it stands out on the tint without competing with the page's primary action. */
  action?: ReactNode;
  className?: string;
};

/**
 * Message about an action's outcome (e.g. the form failed to send). Errors are announced at once
 * (role="alert"); other tones politely (role="status"). The icon and title, not only the color, say
 * what kind of message it is.
 */
export function Alert({ tone, title, children, action, className }: AlertProps) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn(alertVariants({ tone }), className)}>
      <Icon name={toneIcon[tone]} className={cn("mt-0.5", toneText[tone])} />
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <p className={cn("font-semibold", toneText[tone])}>{title}</p>
          {children && <div className="mt-1 text-sm">{children}</div>}
        </div>
        {action}
      </div>
    </div>
  );
}
