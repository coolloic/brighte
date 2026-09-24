import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, spyOn, userEvent } from "storybook/test";
import { ContrastTable, PaletteColors, RoleColors } from "./ColorPalette";
import { contrast, readToken } from "./color";
import { CONTRAST_PAIRS, PALETTE, paletteName, ROLES } from "./tokens";

const meta = {
  title: "Foundations/Colors",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Roles: Story = {
  render: () => <RoleColors />,
  play: async ({ canvas }) => {
    // Every documented role exists in globals.scss and resolves to the palette color it claims.
    for (const role of ROLES) {
      await expect(readToken(role.name), `--color-${role.name} exists`).not.toBeNull();
      await expect(readToken(role.name), `--color-${role.name} uses ${role.maps}`).toEqual(readToken(role.maps));
    }

    const writeText = spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await userEvent.click(canvas.getByRole("button", { name: "Copy Tailwind class bg-action" }));
    await expect(writeText).toHaveBeenCalledWith("bg-action");
    await expect(canvas.getByRole("status")).toHaveTextContent("Copied bg-action");
    writeText.mockRestore();
  },
};

export const Palette: Story = {
  render: () => <PaletteColors />,
  play: async ({ canvas }) => {
    for (const { hue, steps } of PALETTE) {
      for (const { step } of steps) {
        const name = paletteName(hue, step);
        await expect(readToken(name), `--color-${name} exists`).not.toBeNull();
      }
    }

    const writeText = spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await userEvent.click(canvas.getByRole("button", { name: "Copy CSS variable var(--color-green-500)" }));
    await expect(writeText).toHaveBeenCalledWith("var(--color-green-500)");
    await expect(canvas.getByRole("status")).toHaveTextContent("Copied var(--color-green-500)");

    // If the browser refuses (permissions, insecure page), say so instead of failing silently.
    writeText.mockRejectedValue(new Error("denied"));
    await userEvent.click(canvas.getByRole("button", { name: "Copy Tailwind color green-500" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Couldn't copy green-500");
    writeText.mockRestore();
  },
};

export const Contrast: Story = {
  render: () => <ContrastTable />,
  play: async () => {
    for (const pair of CONTRAST_PAIRS) {
      const fg = readToken(pair.fg);
      const bg = readToken(pair.bg);
      await expect(fg && bg, `${pair.fg} and ${pair.bg} exist`).toBeTruthy();
      await expect(contrast(fg!, bg!), `${pair.fg} on ${pair.bg} (${pair.use})`).toBeGreaterThanOrEqual(pair.min);
    }
  },
};
