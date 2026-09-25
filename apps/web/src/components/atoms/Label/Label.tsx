import type { LabelHTMLAttributes, ReactNode } from "react";

export type LabelProps = Omit<LabelHTMLAttributes<HTMLLabelElement>, "htmlFor"> & {
  /** id of the input this label names. */
  htmlFor: string;
  /**
   * Shows a red asterisk, as on Brighte's forms. It is hidden from screen readers: put `required`
   * on the input, which they announce.
   */
  required?: boolean;
  children: ReactNode;
};

/** Field label, styled after Brighte's support form: small, regular weight, required fields marked with *. */
export function Label({ htmlFor, required = false, className = "", children, ...rest }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className={`mb-1.5 block text-sm text-fg ${className}`} {...rest}>
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-danger">
          *
        </span>
      )}
    </label>
  );
}
