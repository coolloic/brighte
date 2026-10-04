import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent } from "storybook/test";
import { Markdown, type MarkdownBlocks } from "./Markdown";

const CV_SUMMARY = `# Candidate summary

**Jane Citizen** is a senior front-end engineer with *8 years* of React experience.

## Strengths

- Design systems and accessibility (WCAG 2.1 AA)
- Performance: Core Web Vitals, \`next/image\`
- Mentoring a team of 4

## Experience

1. **Lead engineer**, Acme (2021–now)
2. Front-end engineer, Globex (2017–2021)

| Requirement | Evidence | Fit |
|---|---|---|
| React + TypeScript | 8 years | Met |
| GraphQL | Apollo at Acme | Met |
| Team leadership | Leads 4 engineers | Partly |

> Ask about her move from Vue to React.

---

More at [her portfolio](https://example.com).`;

const meta = {
  title: "Atoms/Markdown",
  component: Markdown,
  args: { children: CV_SUMMARY },
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="max-w-xl">
      <Markdown {...args} />
    </div>
  ),
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A reply with headings, lists, a table, a quote and a link. */
export const Default: Story = {
  play: async ({ canvas }) => {
    // "#" and "##" become h3 and h4: under the page's h1 and the chat's h2.
    const top = canvas.getByRole("heading", { level: 3, name: "Candidate summary" });
    const sub = canvas.getByRole("heading", { level: 4, name: "Strengths" });
    // The top level stands out from the ones under it.
    await expect(parseFloat(getComputedStyle(top).fontSize)).toBeGreaterThan(parseFloat(getComputedStyle(sub).fontSize));
    await expect(canvas.getAllByRole("list")).toHaveLength(2);
    await expect(canvas.getByRole("table")).toHaveTextContent("Team leadership");
    const link = canvas.getByRole("link", { name: "her portfolio (opens in a new tab)" });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  },
};

/** Code blocks wrap long lines instead of scrolling. */
export const Code: Story = {
  args: {
    children: "Run `pnpm test`, then:\n\n```ts\nconst result = await fetch(`https://example.com/api/a/very/long/path/that/would/otherwise/scroll?query=${encodeURIComponent(value)}`);\n```",
  },
  play: async ({ canvasElement }) => {
    const pre = canvasElement.querySelector("pre")!;
    await expect(pre.scrollWidth).toBeLessThanOrEqual(pre.clientWidth);
  },
};

/** Raw HTML and `javascript:` links from the model are never run: HTML shows as text, the link loses its href. */
export const Unsafe: Story = {
  args: {
    children: 'Hello <img src=x onerror="alert(1)"> <b>bold?</b>\n\n[click me](javascript:alert(1))\n\n![tracking pixel](https://example.com/pixel.png)',
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("img, b")).toBeNull();
    await expect(canvas.getByText("click me").closest("a")?.getAttribute("href") ?? "").not.toMatch(/javascript/i);
    // Images become links to them, never loaded.
    await expect(canvas.getByRole("link", { name: "tracking pixel (image, opens in a new tab)" })).toHaveAttribute("href", "https://example.com/pixel.png");
  },
};

/** A reply cut off mid-stream: unfinished syntax shows as plain text until the rest arrives. */
export const Streaming: Story = {
  args: { children: "Here are her strengths:\n\n- **Design sys" },
};

/** Fenced blocks in a registered language render through their function; other languages stay code. */
export const CustomBlock: Story = {
  args: {
    children: "Before.\n\n```shout\nhello\n```\n\n```ts\nconst a = 1;\n```\n\n```constructor\nnot a block\n```\n\nAfter.",
    blocks: { shout: (code) => <p data-testid="shout">{code.trim().toUpperCase()}!</p> },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByTestId("shout")).toHaveTextContent("HELLO!");
    // Unregistered languages, including names every object has, are ordinary code blocks.
    const pres = canvasElement.querySelectorAll("pre");
    await expect(pres).toHaveLength(2);
    await expect(pres[0]).toHaveTextContent("const a = 1;");
    await expect(pres[1]).toHaveTextContent("not a block");
    await expect(canvas.getByText("After.")).toBeInTheDocument();
  },
};

const SHOUT_BLOCKS: MarkdownBlocks = { shout: (code) => <p data-testid="shout">{code.trim().toUpperCase()}!</p> };

/** A streaming reply re-renders on every chunk: its code and component blocks must stay mounted (selection, live regions). */
export const StableAcrossRerenders: Story = {
  render: function Render() {
    const [extra, setExtra] = useState("");
    return (
      <div className="max-w-xl">
        <button type="button" onClick={() => setExtra((text) => `${text} more`)}>
          Add text
        </button>
        <Markdown blocks={SHOUT_BLOCKS}>{`\`\`\`ts\nconst a = 1;\n\`\`\`\n\n\`\`\`shout\nhello\n\`\`\`\n\nStreaming${extra}`}</Markdown>
      </div>
    );
  },
  play: async ({ canvas, canvasElement }) => {
    const pre = canvasElement.querySelector("pre");
    const shout = canvas.getByTestId("shout");
    await userEvent.click(canvas.getByRole("button", { name: "Add text" }));
    await expect(canvas.getByText("Streaming more")).toBeInTheDocument();
    await expect(canvasElement.querySelector("pre")).toBe(pre);
    await expect(canvas.getByTestId("shout")).toBe(shout);
  },
};
