import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { MatchReport } from "./MatchReport";

const meta = {
  title: "Molecules/MatchReport",
  component: MatchReport,
  parameters: { layout: "padded" },
  args: {
    title: "Senior Front-end Engineer · Acme",
    score: 72,
    summary: "Strong React and accessibility match; GraphQL isn't shown.",
    items: [
      { requirement: "5+ years React", status: "met", evidence: "8 years of React at Acme and Globex" },
      { requirement: "Accessibility (WCAG 2.1 AA)", status: "met", evidence: "Led the WCAG audit at Acme" },
      { requirement: "Team leadership", status: "partial", evidence: "Mentored 2 graduates", suggestion: "Say what changed for the people you mentored." },
      { requirement: "GraphQL", status: "missing", suggestion: "If you've used it, add where; if not, mention it as something you're learning." },
    ],
  },
  render: (args) => (
    <div className="max-w-xl">
      <MatchReport {...args} />
    </div>
  ),
} satisfies Meta<typeof MatchReport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Typical: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Senior Front-end Engineer · Acme" })).toBeInTheDocument();
    await expect(canvas.getByText("72%").parentElement).toHaveTextContent("72% match");
    await expect(canvas.getByText("2 met · 1 partly · 1 missing")).toBeInTheDocument();
    const items = canvas.getAllByRole("listitem");
    await expect(items).toHaveLength(4);
    // Status in words, not colour alone.
    await expect(items[2]).toHaveTextContent("Partly");
    await expect(items[3]).toHaveTextContent("Missing");
    await expect(items[3]).toHaveTextContent("Suggestion: If you've used it");
  },
};

export const AllMet: Story = {
  args: { score: 100, summary: undefined, items: [{ requirement: "React", status: "met", evidence: "8 years" }] },
  play: async ({ canvas }) => {
    // Zero counts are left out.
    await expect(canvas.getByText("1 met")).toBeInTheDocument();
  },
};

export const AllMissing: Story = {
  args: {
    score: 0,
    items: [
      { requirement: "Rust", status: "missing" },
      { requirement: "Embedded systems", status: "missing" },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("0%").parentElement).toHaveTextContent("0% match");
    await expect(canvas.getByText("2 missing")).toBeInTheDocument();
  },
};

/** Long text wraps at a phone's width instead of scrolling. */
export const LongText: Story = {
  args: {
    title: "Principal Platform Engineer, Developer Experience and Internal Tooling · A Very Long Company Name Pty Ltd",
    items: [{ requirement: "https://example.com/".concat("a".repeat(80)), status: "partial", evidence: "x".repeat(300) }],
  },
  render: (args) => (
    <div className="w-[320px]">
      <MatchReport {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const report = canvasElement.querySelector("article")!;
    await expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth);
  },
};
