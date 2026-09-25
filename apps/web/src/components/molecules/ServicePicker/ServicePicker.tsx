import { Checkbox } from "@/components/atoms/Checkbox";
import { FieldError } from "@/components/atoms/FieldError";

export type ServiceOption = { code: string; label: string };

export type ServicePickerProps = {
  id: string;
  legend: string;
  options: ServiceOption[];
  /** Selected service codes. */
  value: string[];
  onChange: (value: string[]) => void;
  /** Form field name: each checked box submits its code, so a plain form submit works too. */
  name?: string;
  required?: boolean;
  hint?: string;
  error?: string;
};

/**
 * Pick one or more services. Each option is a card: the whole card is the touch target, and a selected
 * card shows the tick plus a green border and tint (not color alone).
 */
export function ServicePicker({
  id,
  legend,
  options,
  value,
  onChange,
  name = "services",
  required = false,
  hint,
  error,
}: ServicePickerProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;
  const toggle = (code: string, checked: boolean) =>
    onChange(checked ? [...value, code] : value.filter((selected) => selected !== code));

  return (
    <fieldset id={id} aria-describedby={describedBy}>
      <legend className="mb-1.5 text-sm text-fg">
        {legend}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.code}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border border-border-strong px-4 py-3 text-body text-fg transition-[background-color,border-color] duration-150 hover:bg-surface-muted has-checked:border-action has-checked:bg-surface-brand"
          >
            <Checkbox
              name={name}
              value={option.code}
              checked={value.includes(option.code)}
              onChange={(event) => toggle(option.code, event.target.checked)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-fg-muted">
          {hint}
        </p>
      )}
    </fieldset>
  );
}
