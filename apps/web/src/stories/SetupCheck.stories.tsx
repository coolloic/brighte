import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Guards the Storybook pipeline itself: if Tailwind or globals.scss stop loading here, every
// component story would look unstyled, so this fails first.
const meta = {
  title: "Internal/Setup check",
  parameters: { docs: { disable: true } },
} satisfies Meta;

export default meta;

export const TailwindAndGlobalStyles: StoryObj = {
  render: () => (
    <main>
      <h1 className="p-4 text-2xl font-bold">Storybook is wired up</h1>
      <p className="px-4">Tailwind utilities and global styles from globals.scss apply here.</p>
    </main>
  ),
  play: async ({ canvas }) => {
    const heading = canvas.getByRole("heading", { level: 1 });
    // Tailwind's p-4 = 1rem; only true if the Tailwind PostCSS pipeline ran.
    await expect(getComputedStyle(heading).paddingTop).toBe("16px");
    // globals.scss sets the body text colour from the --foreground variable.
    await expect(getComputedStyle(document.body).color).toBe("rgb(23, 23, 23)");
  },
};
