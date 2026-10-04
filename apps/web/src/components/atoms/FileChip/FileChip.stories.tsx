import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { FileChip } from "./FileChip";

// A 1x1 green PNG, as a thumbnail.
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/1+4mRgAAAABJRU5ErkJggg==";

const meta = {
  title: "Atoms/FileChip",
  component: FileChip,
  args: { name: "menu.pdf", kind: "pdf", detail: "820 KB" },
  parameters: { layout: "padded" },
} satisfies Meta<typeof FileChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pdf: Story = {};

export const Image: Story = { args: { name: "storefront.png", kind: "image", detail: "1.2 MB", previewSrc: PIXEL } };

/** In the message box: a 44px remove button, named after the file. */
export const Removable: Story = {
  args: { onRemove: fn() },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Remove menu.pdf" }));
    await expect(args.onRemove).toHaveBeenCalledTimes(1);
  },
};

/** A long name is cut to one line; the whole name is in the title. */
export const LongName: Story = {
  args: { name: `${"quarterly-sales-report-".repeat(4)}final.csv`, kind: "text", detail: "12 KB" },
  render: (args) => (
    <div className="w-64">
      <FileChip {...args} />
    </div>
  ),
};
