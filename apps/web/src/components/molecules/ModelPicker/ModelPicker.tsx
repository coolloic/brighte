"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/atoms/Icon";
import { Label } from "@/components/atoms/Label";
import { Select } from "@/components/atoms/Select";
import { cn } from "@/lib/cn";
import { modelKey, type ModelOption } from "@/lib/llm/types";

export type ModelPickerProps = {
  id: string;
  options: ModelOption[];
  /** The picked model's key, "provider:model" (modelKey). */
  value: string;
  onChange: (key: string) => void;
  className?: string;
};

/**
 * Picks the LLM that answers. Rarely changed, so it is compact: a small button naming the current
 * model, which opens a panel (above it) with the provider and model selects. A disclosure button
 * (aria-expanded): screen readers hear "Model: <name>, <provider>" and whether it is open, the
 * selects come next in tab order, and Escape closes the panel and returns focus to the button. A
 * click or tap outside also closes it.
 * Choosing another provider picks its first model. Applies to the next message, so it can change
 * at any time.
 */
export function ModelPicker({ id, options, value, onChange, className }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const current = options.find((option) => modelKey(option) === value) ?? options[0];
  const providers = options.filter((option, index) => options.findIndex((other) => other.provider === option.provider) === index);
  const models = options.filter((option) => option.provider === current?.provider);
  const panelId = `${id}-panel`;

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    setOpen(false);
    button.current?.focus();
  };

  // A press anywhere outside closes the panel (focus stays where the visitor put it).
  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeIfOutside);
    return () => document.removeEventListener("pointerdown", closeIfOutside);
  }, [open]);

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        onKeyDown={closeOnEscape}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control px-2 text-sm text-fg-muted transition-[background-color] hover:bg-surface-muted focus-visible:focus-ring"
      >
        {/* One phrase for screen readers (split spans get extra spaces); it contains the visible text (WCAG 2.5.3). */}
        <span className="sr-only">
          Model: {current?.label}, {current?.providerLabel}
        </span>
        <span aria-hidden="true">{current?.label}</span>
        <Icon name="chevron-down" className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
      </button>

      {/* Opens upwards: the picker sits at the bottom of the screen, under the message box. */}
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 bottom-full z-10 mb-2 w-72 max-w-[calc(100vw-3rem)] space-y-3 rounded-card border border-border bg-surface p-4 shadow-card"
      >
        <div>
          <Label htmlFor={`${id}-provider`}>Provider</Label>
          <Select
            id={`${id}-provider`}
            value={current?.provider}
            onKeyDown={closeOnEscape}
            onChange={(event) => {
              const first = options.find((option) => option.provider === event.target.value);
              if (first) onChange(modelKey(first));
            }}
          >
            {providers.map((option) => (
              <option key={option.provider} value={option.provider}>
                {option.providerLabel}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-model`}>Model</Label>
          <Select id={`${id}-model`} value={value} onKeyDown={closeOnEscape} onChange={(event) => onChange(event.target.value)}>
            {models.map((option) => (
              <option key={modelKey(option)} value={modelKey(option)}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-sm text-fg-muted">Applies from your next message.</p>
      </div>
    </div>
  );
}
