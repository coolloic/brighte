import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, spyOn, userEvent } from "storybook/test";
import { ICON_NAMES } from "@/components/atoms/Icon";
import { IconGallery } from "./IconGallery";

const meta = {
  title: "Foundations/Icons",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Catalogue: Story = {
  render: () => <IconGallery />,
  play: async ({ canvas, canvasElement }) => {
    // The catalogue previews are decorative (the name is printed next to them): hidden from screen readers.
    const previews = canvasElement.querySelectorAll("li svg");
    await expect(previews).toHaveLength(ICON_NAMES.length);
    for (const svg of previews) await expect(svg).toHaveAttribute("aria-hidden", "true");
    // With a label, an icon is announced.
    await expect(canvas.getByRole("img", { name: "More information" })).toBeInTheDocument();

    const writeText = spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    // Default size: no className in the snippet.
    await userEvent.click(canvas.getByRole("button", { name: 'Copy snippet <Icon name="alert-circle" />' }));
    await expect(writeText).toHaveBeenCalledWith('<Icon name="alert-circle" />');

    // Picking 16px updates the previews and the snippets.
    await userEvent.click(canvas.getByRole("radio", { name: "16px" }));
    await expect(canvasElement.querySelector("li svg")!.getBoundingClientRect().width).toBe(16);
    await userEvent.click(canvas.getByRole("button", { name: 'Copy snippet <Icon name="alert-circle" className="size-4" />' }));
    await expect(writeText).toHaveBeenLastCalledWith('<Icon name="alert-circle" className="size-4" />');
    await expect(canvas.getByRole("status")).toHaveTextContent('Copied <Icon name="alert-circle" className="size-4" />');
    writeText.mockRestore();
  },
};
