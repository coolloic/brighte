import { FieldError } from "@/components/atoms/FieldError";
import { Input, type InputProps } from "@/components/atoms/Input";
import { Label } from "@/components/atoms/Label";

export type FormFieldProps = Omit<InputProps, "id" | "invalid"> & {
  id: string;
  label: string;
  /** Guidance shown below the field, e.g. an example format. */
  hint?: string;
  /** Validation message. Shows the error box and marks the input invalid. */
  error?: string;
};

/**
 * Label, input, hint and error wired together. The hint sits right below the field and stays put;
 * the error box appears under it. Screen readers read the error first, then the hint.
 */
export function FormField({ id, label, hint, error, required, className, ...inputProps }: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  // Error first: a screen reader announces the problem before the guidance.
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Input id={id} required={required} invalid={Boolean(error)} aria-describedby={describedBy} {...inputProps} />
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-fg-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
