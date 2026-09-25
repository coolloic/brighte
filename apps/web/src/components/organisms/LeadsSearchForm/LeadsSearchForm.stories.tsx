import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { LeadsSearchForm } from "./LeadsSearchForm";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A–Z" },
];

const meta = {
  title: "Organisms/LeadsSearchForm",
  component: LeadsSearchForm,
  args: {
    action: "/admin",
    query: "",
    onQueryChange: fn(),
    sort: "newest",
    sortOptions: SORT_OPTIONS,
    onSortChange: fn(),
    hiddenFields: { service: "delivery", size: "50" },
    onSubmit: fn((event: { preventDefault: () => void }) => event.preventDefault()),
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof LeadsSearchForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Each keystroke is reported. There's no Search button: with JavaScript the results follow the
 * typing (it's inside <noscript> for browsers without). Enter submits in real browsers (a form with
 * one text field needs no button for that; simulated key events don't follow that rule, so it's
 * checked in e2e/leads-dashboard.spec.ts). The form keeps the filter and page size.
 */
export const Default: Story = {
  play: async ({ args, canvas, canvasElement }) => {
    const form = canvas.getByRole("search", { name: "Leads" });
    await expect(form).toHaveAttribute("method", "get");
    await expect(canvasElement.querySelector('input[type="hidden"][name="service"]')).toHaveValue("delivery");
    await expect(canvasElement.querySelector('input[type="hidden"][name="size"]')).toHaveValue("50");
    await expect(canvas.queryByRole("button", { name: "Search" })).toBeNull();

    const box = canvas.getByRole("searchbox", { name: "Search leads" });
    await userEvent.type(box, "a");
    await expect(args.onQueryChange).toHaveBeenLastCalledWith("a");
    // The browser's clear (×) button shows the pointer, like other clickable things. Chrome doesn't
    // compute styles for that pseudo-element, so check the page has a pointer rule that matches it.
    // Tailwind's utilities sit inside @layer blocks: walk nested rules too.
    const allRules = (rules: CSSRuleList): CSSRule[] =>
      [...rules].flatMap((rule) => ("cssRules" in rule ? [rule, ...allRules((rule as CSSGroupingRule).cssRules)] : [rule]));
    const cancelRules = [...document.styleSheets]
      .flatMap((sheet) => allRules(sheet.cssRules))
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.selectorText.includes("::-webkit-search-cancel-button"));
    await expect(cancelRules.some((rule) => rule.style.cursor === "pointer" && box.matches(rule.selectorText.split("::")[0]))).toBe(true);
  },
};

/** "Sort by" is for phones, where the list is cards without column headers. */
export const SortOnPhones: Story = {
  args: { query: "ada", sort: "name_asc" },
  play: async ({ args, canvas }) => {
    const sort = canvas.getByRole("combobox", { name: "Sort by", hidden: true });
    await expect(sort).toHaveValue("name_asc");
    await userEvent.selectOptions(sort, "oldest");
    await expect(args.onSortChange).toHaveBeenLastCalledWith("oldest");
  },
};
