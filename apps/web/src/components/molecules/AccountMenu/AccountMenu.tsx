"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";

export type AccountMenuProps = {
  name: string;
  email: string;
  /** What Sign out submits to, e.g. a Server Action. */
  signOutAction: ComponentProps<"form">["action"];
};

/** "Grace Hopper" → "GH", "Admin" → "A". */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/**
 * The signed-in account, as admin portals show it: an avatar with the user's initials in the header,
 * opening a panel with their name, email and Sign out. A native <details> disclosure: it opens with a
 * click, Enter or Space, screen readers announce expanded/collapsed, and it works without JavaScript.
 * With JavaScript it also closes like a menu: on a click outside, on Escape (focus back on the avatar),
 * and when focus leaves it.
 */
export function AccountMenu({ name, email, signOutAction }: AccountMenuProps) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const close = () => {
      details.open = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (details.open && !details.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !details.open) return;
      close();
      details.querySelector("summary")?.focus();
    };
    const onFocusOut = (event: FocusEvent) => {
      // relatedTarget is null when focus goes to nothing focusable (e.g. a click on the page), which
      // pointerdown already handles; only close when focus moves somewhere else.
      if (event.relatedTarget && !details.contains(event.relatedTarget as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    details.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      details.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return (
    <details ref={ref} className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-full focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-surface-brand font-bold text-fg-brand">
          {initials(name)}
        </span>
        <Icon name="chevron-left" className="size-4 -rotate-90 text-fg-muted transition-transform group-open:rotate-90" />
        <span className="sr-only">Account menu for {name}</span>
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-64 rounded-card border border-border bg-surface p-4 shadow-card">
        <p className="font-semibold text-fg">{name}</p>
        <p className="truncate text-sm text-fg-muted" title={email}>
          {email}
        </p>
        <form action={signOutAction} className="mt-3 border-t border-border pt-3">
          <Button type="submit" variant="secondary" fullWidth>
            Sign out
          </Button>
        </form>
      </div>
    </details>
  );
}
