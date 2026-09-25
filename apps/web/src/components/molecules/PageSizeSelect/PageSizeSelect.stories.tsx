import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { PageSizeSelect } from "./PageSizeSelect";

const meta = {
  title: "Molecules/PageSizeSelect",
  component: PageSizeSelect,
  args: { value: 20, options: [10, 20, 50, 100], onChange: fn(), action: "/admin", hiddenFields: { q: "ada", sort: "name_asc" } },
  parameters: { layout: "padded" },
} satisfies Meta<typeof PageSizeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Labelled "Per page"; a choice is reported at once, and the form keeps the search and sort. */
export const Default: Story = {
  play: async ({ args, canvas, canvasElement }) => {
    const select = canvas.getByRole("combobox", { name: "Per page" });
    await expect(select).toHaveValue("20");
    await expect(canvasElement.querySelector('input[type="hidden"][name="q"]')).toHaveValue("ada");
    await userEvent.selectOptions(select, "50");
    await expect(args.onChange).toHaveBeenLastCalledWith(50);
    // The Apply button is only for browsers without JavaScript.
    await expect(canvas.queryByRole("button", { name: "Apply" })).toBeNull();
  },
};
