import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { CvButtons } from "./CvButtons";

const meta = {
  title: "Molecules/CvButtons",
  component: CvButtons,
  args: {
    onDownload: fn(async (): Promise<string | undefined> => undefined),
    onPreview: fn(async (): Promise<{ url: string } | { error: string }> => ({ error: "nope" })),
    onSave: fn(),
  },
} satisfies Meta<typeof CvButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Save profile" }));
    await expect(args.onSave).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Download PDF" }));
    await expect(args.onDownload).toHaveBeenCalledTimes(1);
  },
};

/** One request at a time: busy while the PDF is made. */
export const Busy: Story = {
  args: { onDownload: fn(() => new Promise<undefined>(() => {})) },
  play: async ({ canvas, args }) => {
    const download = canvas.getByRole("button", { name: "Download PDF" });
    await userEvent.click(download);
    await expect(canvas.getByRole("status")).toHaveTextContent("Preparing PDF…");
    await expect(download).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Preview PDF" })).toBeDisabled();
    await expect(args.onDownload).toHaveBeenCalledTimes(1);
  },
};

export const Failed: Story = {
  args: { onDownload: fn(async () => "The PDF couldn't be made. Please try again.") },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Download PDF" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("The PDF couldn't be made. Please try again.");
    await expect(canvas.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  },
};

export const Disabled: Story = {
  args: { onSave: undefined, disabledReason: "Fix 2 things before downloading" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Preview PDF" })).toBeDisabled();
    await expect(canvas.getByText("Fix 2 things before downloading")).toBeInTheDocument();
    // Disabled buttons can't be focused: screen readers still get the reason as their description.
    await expect(canvas.getByRole("button", { name: "Download PDF" })).toHaveAccessibleDescription("Fix 2 things before downloading");
    await expect(canvas.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
  },
};

/** After the preview dialog closes, focus is back on Preview PDF (it was disabled while the PDF loaded). */
export const PreviewReturnsFocus: Story = {
  args: {
    // Takes a moment, like the real request: long enough for the browser to move focus off the disabled button.
    onPreview: fn(async (): Promise<{ url: string } | { error: string }> => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { url: "about:blank" };
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    const preview = canvas.getByRole("button", { name: "Preview PDF" });
    await userEvent.click(preview);
    const dialog = await canvas.findByRole("dialog", { name: "CV preview" });
    const closed = new Promise((resolve) => dialog.addEventListener("close", resolve, { once: true }));
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await closed;
    // The owner gives focus back once the dialog is gone.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(canvasElement.ownerDocument.activeElement).toBe(preview);
  },
};

/**
 * On a phone, a popup opened after the PDF loads is blocked (no longer a tap), so a link to it is
 * shown instead: tapping it opens the PDF.
 */
export const PreviewOnPhone: Story = {
  args: { onPreview: fn(async (): Promise<{ url: string } | { error: string }> => ({ url: "about:blank#cv" })) },
  play: async ({ canvas }) => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...matchMedia.call(window, query), matches: false })) as typeof window.matchMedia;
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Preview PDF" }));
      const link = await canvas.findByRole("link", { name: "Open the PDF (opens in a new tab)" });
      await expect(link).toHaveAttribute("href", "about:blank#cv");
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      window.matchMedia = matchMedia;
    }
  },
};

