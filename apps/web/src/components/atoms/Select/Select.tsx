import type { Ref, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../Icon";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> };

/**
 * A native <select>, styled like Input (1px border, 4px corners, 44px tall, focus turns it green),
 * with a chevron. Native, so the keyboard, screen readers and phone pickers work as users expect.
 * Always give it a <Label htmlFor>.
 */
export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          "block min-h-11 w-full cursor-pointer appearance-none rounded-control border border-border-strong bg-surface py-2.5 pr-10 pl-3 text-body text-fg",
          "focus-visible:border-focus focus-visible:outline-1 focus-visible:outline-focus",
          "disabled:cursor-not-allowed disabled:bg-surface-muted",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <Icon name="chevron-down" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted" />
    </div>
  );
}
