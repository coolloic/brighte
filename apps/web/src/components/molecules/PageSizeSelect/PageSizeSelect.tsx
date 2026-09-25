import { Button } from "@/components/atoms/Button";
import { Label } from "@/components/atoms/Label";
import { Select } from "@/components/atoms/Select";

export type PageSizeSelectProps = {
  value: number;
  options: readonly number[];
  onChange: (value: number) => void;
  /** Where the form goes without JavaScript (a GET, so the choice lands in the URL). */
  action: string;
  /** Kept when the form is submitted, e.g. the search, filter and sort. */
  hiddenFields?: Record<string, string | undefined>;
};

/**
 * "Per page", for beside a Pagination. A small GET form: with JavaScript the page follows the
 * choice at once; without it, an Apply button (inside <noscript>) submits it.
 */
export function PageSizeSelect({ value, options, onChange, action, hiddenFields = {} }: PageSizeSelectProps) {
  return (
    <form action={action} method="get" className="flex items-center gap-2">
      {Object.entries(hiddenFields).map(([name, field]) => field && <input key={name} type="hidden" name={name} value={field} />)}
      <Label htmlFor="page-size" className="mb-0 whitespace-nowrap">
        Per page
      </Label>
      <div className="w-24">
        <Select id="page-size" name="size" value={value} onChange={(event) => onChange(Number(event.target.value))}>
          {options.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </div>
      <noscript>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </noscript>
    </form>
  );
}
