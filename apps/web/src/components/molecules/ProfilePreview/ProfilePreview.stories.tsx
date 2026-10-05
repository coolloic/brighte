import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { ProfilePreview } from "./ProfilePreview";

const meta = {
  title: "Molecules/ProfilePreview",
  component: ProfilePreview,
  parameters: { layout: "padded" },
  args: {
    basics: {
      name: "Jane Citizen",
      headline: "Front-end Engineer",
      email: "jane@example.com",
      phone: "0412 345 678",
      location: { city: "Sydney", region: "NSW" },
      links: [
        { label: "GitHub", url: "https://github.com/jane" },
        { label: "LinkedIn", url: "https://linkedin.com/in/jane" },
      ],
      summary: "Front-end engineer with 8 years building accessible React applications.",
    },
    work: [
      {
        employer: "Acme Lending",
        position: "Senior Front-end Engineer",
        location: "Sydney",
        start: "2021-03",
        end: "present",
        highlights: ["Led the React + TypeScript rebuild of the customer loan portal.", "Ran the WCAG 2.1 AA audit."],
        skills: ["React", "TypeScript", "axe"],
      },
      { employer: "Globex Insurance", position: "Front-end Engineer", start: "2017", end: "2021", skills: ["React", "Redux"] },
    ],
    education: [{ institution: "University of Sydney", qualification: "BSc", field: "Computer Science", end: "2016" }],
    skills: [
      { group: "Front-end", keywords: ["React", "TypeScript", "Next.js"] },
      { keywords: ["Jest", "Cypress"] },
    ],
    certificates: [{ name: "AWS Cloud Practitioner", issuer: "AWS", date: "2022-05" }],
    projects: [{ name: "a11y-lint", description: "Lint rules for accessible JSX.", url: "https://github.com/jane/a11y-lint", skills: ["ESLint"] }],
    languages: [{ language: "English", fluency: "Native" }, { language: "Mandarin" }],
  },
  render: (args) => (
    <div className="max-w-xl">
      <ProfilePreview {...args} />
    </div>
  ),
} satisfies Meta<typeof ProfilePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Jane Citizen" })).toBeInTheDocument();
    await expect(canvas.getByText("Sydney, NSW · jane@example.com · 0412 345 678")).toBeInTheDocument();
    for (const section of ["Summary", "Experience", "Education", "Skills", "Certificates", "Projects", "Languages"]) {
      await expect(canvas.getByRole("heading", { level: 4, name: section })).toBeInTheDocument();
    }
    await expect(canvas.getByText("Senior Front-end Engineer · Acme Lending")).toBeInTheDocument();
    await expect(canvas.getByText("Sydney · Mar 2021 – Present")).toBeInTheDocument();
    await expect(canvas.getByText("2017 – 2021")).toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "Skills at Acme Lending" })).toHaveTextContent("axe");
    await expect(canvas.getByText("BSc, Computer Science · University of Sydney")).toBeInTheDocument();
    // A degree with only an end year: that's when it was completed, not "Until 2016".
    await expect(canvas.getByText("2016", { exact: true })).toBeInTheDocument();
    await expect(canvas.getByText("AWS Cloud Practitioner · AWS · May 2022")).toBeInTheDocument();
    await expect(canvas.getByText("English (Native), Mandarin")).toBeInTheDocument();
    const github = canvas.getByRole("link", { name: "GitHub (opens in a new tab)" });
    await expect(github).toHaveAttribute("href", "https://github.com/jane");
    await expect(github).toHaveAttribute("target", "_blank");
    await expect(github).toHaveAttribute("rel", "noopener noreferrer");
  },
};

/** Only a name: no empty sections, no stray separators. */
export const NameOnly: Story = {
  args: { basics: { name: "Jane Citizen", headline: "", email: "" }, work: undefined, education: undefined, skills: undefined, certificates: undefined, projects: undefined, languages: undefined },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Jane Citizen" })).toBeInTheDocument();
    await expect(canvas.queryAllByRole("heading", { level: 4 })).toHaveLength(0);
    await expect(canvasElement.textContent).not.toContain("·");
  },
};

/** Dates as precise as the CV: a year alone, and a start with no end. */
export const YearOnlyDates: Story = {
  args: { work: [{ employer: "Initech", position: "Developer", start: "2019" }], education: undefined, certificates: undefined, projects: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("From 2019")).toBeInTheDocument();
  },
};

/** Long text wraps at a phone's width. */
export const LongText: Story = {
  args: {
    basics: { name: "Jane Citizen", email: "a.very.long.email.address.for.testing.wrapping@example-company-with-long-domain.com.au" },
    work: [{ employer: "A Very Long Employer Name Pty Ltd", position: "Principal Engineer", highlights: ["x".repeat(400)] }],
  },
  render: (args) => (
    <div className="w-[320px]">
      <ProfilePreview {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector("article")!;
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  },
};
