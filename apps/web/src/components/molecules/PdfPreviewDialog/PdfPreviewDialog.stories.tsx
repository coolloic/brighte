import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { PdfPreviewDialog } from "./PdfPreviewDialog";

const meta = {
  title: "Molecules/PdfPreviewDialog",
  component: PdfPreviewDialog,
  args: { url: "about:blank", onClose: fn() },
} satisfies Meta<typeof PdfPreviewDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ canvas, args }) => {
    const dialog = canvas.getByRole("dialog", { name: "CV preview" });
    await expect(dialog).toHaveAttribute("open");
    await expect(canvas.getByTitle("CV preview")).toHaveAttribute("src", "about:blank");
    // The dialog's close event comes after the click, in a later task: wait for it.
    const closed = new Promise((resolve) => dialog.addEventListener("close", resolve, { once: true }));
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await closed;
    await expect(dialog).not.toHaveAttribute("open");
    await expect(args.onClose).toHaveBeenCalled();
  },
};
