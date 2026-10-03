import { Label } from "@/components/atoms/Label";
import { Select } from "@/components/atoms/Select";
import { modelKey, type ModelOption } from "@/lib/llm/types";

export type ModelPickerProps = {
  id: string;
  options: ModelOption[];
  /** The picked model's key, "provider:model" (modelKey). */
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
  className?: string;
};

/** Picks the LLM that answers: a native select, the models grouped by provider. */
export function ModelPicker({ id, options, value, onChange, disabled, className }: ModelPickerProps) {
  const providers = [...new Set(options.map((option) => option.providerLabel))];
  return (
    <div className={className}>
      <Label htmlFor={id}>Model</Label>
      <Select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {providers.map((provider) => (
          <optgroup key={provider} label={provider}>
            {options
              .filter((option) => option.providerLabel === provider)
              .map((option) => (
                <option key={modelKey(option)} value={modelKey(option)}>
                  {option.label}
                </option>
              ))}
          </optgroup>
        ))}
      </Select>
    </div>
  );
}
