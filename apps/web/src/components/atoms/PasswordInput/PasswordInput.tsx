"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../Icon";
import { Input, type InputProps } from "../Input";

export type PasswordInputProps = Omit<InputProps, "type"> & { id: string };

/**
 * Password input with a show/hide toggle (an eye icon) inside its right edge. The toggle is a real
 * button, named "Show password" and marked pressed while the password is visible, with a 44px
 * target. Visible text isn't spell-checked, so the password isn't sent to a spelling service.
 */
export function PasswordInput({ id, className, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        // Room for the toggle, so text never runs under it.
        className={cn("pr-12", className)}
        {...rest}
      />
      <button
        type="button"
        aria-label="Show password"
        aria-pressed={visible}
        aria-controls={id}
        disabled={rest.disabled}
        onClick={() => setVisible((shown) => !shown)}
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-control text-fg-muted hover:text-fg focus-visible:focus-ring disabled:cursor-not-allowed"
      >
        <Icon name={visible ? "eye-off" : "eye"} />
      </button>
    </div>
  );
}
