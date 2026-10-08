import { describe, expect, it } from "vitest";
import type { Profile } from "../chat";
import { pdfBlockTops, pdfPageCount, pdfPagesText, pdfText, pdfTextLines } from "./pdf-text";
import { renderCoverLetterPdf, renderCvPdf } from "./render";

/** A long CV: `roles` roles of `bullets` bullets of about `length` characters. */
const long = (roles: number, bullets: number, length: number): Profile => ({
  basics: { name: "Jane Citizen" },
  work: Array.from({ length: roles }, (_, i) => ({
    employer: `Employer ${i + 1}`,
    position: `Senior Developer ${i + 1}`,
    start: "2010",
    end: "2011",
    highlights: Array.from({ length: bullets }, (_, j) => `Bullet ${j + 1}: ${"did a well-described piece of work ".repeat(Math.ceil(length / 35))}`.slice(0, length)),
  })),
});

const cv: Profile = {
  basics: {
    name: "Jane Citizen",
    headline: "Senior Front-end Engineer",
    email: "jane@example.com",
    location: { city: "Sydney", region: "NSW" },
    links: [{ label: "GitHub", url: "https://github.com/jane" }],
    summary: "Front-end engineer with 8 years of React.",
  },
  work: [
    {
      employer: "Acme Lending",
      position: "Senior Front-end Engineer",
      location: "Sydney",
      start: "2021-03",
      end: "present",
      highlights: ["Led the React rebuild of the loan portal (40k monthly users)."],
      skills: ["React"],
    },
  ],
  education: [{ institution: "University of Sydney", qualification: "BSc", field: "Computer Science", end: "2016" }],
  skills: [{ group: "Front-end", keywords: ["React", "TypeScript"] }],
};

describe("renderCvPdf", () => {
  it("renders a PDF with the CV's text, in the preview's wording", async () => {
    const pdf = await renderCvPdf(cv);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // Whitespace-normalised: a font change (bold "Front-end: ") starts a new text object in the PDF.
    const text = pdfText(pdf).replace(/\s+/g, " ");
    for (const expected of [
      "Jane Citizen",
      "Senior Front-end Engineer",
      "Sydney, NSW · jane@example.com",
      "github.com/jane",
      "EXPERIENCE",
      "Mar 2021 – Present",
      "Acme Lending · Sydney",
      "Led the React rebuild of the loan portal (40k monthly users).",
      "BSc, Computer Science · University of Sydney",
      "2016",
      "Front-end: React, TypeScript",
    ]) {
      expect(text).toContain(expected);
    }
    // Role skills are covered by the Skills section, not printed as badges.
    expect(text.match(/React/g)?.length).toBe(3);
    expect(pdfPageCount(pdf)).toBe(1);
    expect(text).not.toContain("Page 1 of");
  });

  it("gives the 22pt name its own line height, so the headline sits below it", async () => {
    const [nameTop, headlineTop] = pdfBlockTops(await renderCvPdf(cv));
    // At least the name's size plus a little: it overlapped when it inherited the page's 10pt × 1.35.
    expect(headlineTop - nameTop).toBeGreaterThanOrEqual(22 * 1.15);
  });

  it("places every block on the page, the page-number footer included", async () => {
    const pdf = await renderCvPdf(long(12, 8, 200));
    // A4 is 841.89pt tall: the footer was drawn thousands of points off the page.
    for (const top of pdfBlockTops(pdf)) {
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top).toBeLessThanOrEqual(842);
    }
  });

  it("spaces body lines at 1.35 of 10pt, not more", async () => {
    // Five one-line bullets: their baselines are about one line apart (13.5pt) plus the 2pt gap.
    const lines = pdfTextLines(await renderCvPdf(long(1, 5, 40))).filter((line) => line.text.startsWith("Bullet"));
    expect(lines).toHaveLength(5);
    const gaps = lines.slice(1).map((line, i) => lines[i].y - line.y);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThan(12);
      expect(gap).toBeLessThan(18);
    }
  });

  it("renders a very long CV (at the schema's limits) without failing", async () => {
    const pdf = await renderCvPdf(long(20, 8, 300));
    expect(pdfPageCount(pdf)).toBeGreaterThan(3);
  });

  const longTitle: Profile = {
    basics: { name: "Jane Citizen" },
    education: [
      {
        institution: "Queensland University of Technology",
        qualification: "Master of Information Technology",
        field: "Software Engineering and Human-Computer Interaction",
        start: "2014",
        end: "2016",
      },
    ],
  };

  it("wraps a long title before the dates instead of running under them", async () => {
    const lines = pdfText(await renderCvPdf(longTitle)).split("\n");
    const first = lines.find((line) => line.startsWith("Master of Information Technology"))!;
    // With the dates' width taken, "…Interaction" no longer fits on the first line.
    expect(first).not.toContain("Interaction");
    expect(lines).toContain("2014 – 2016");
  });

  it("never hyphenates words or links", async () => {
    const links = Array.from({ length: 8 }, (_, i) => ({ label: `Link ${i}`, url: `https://example.com/portfolio/project-number-${i}` }));
    const text = pdfText(await renderCvPdf({ ...longTitle, basics: { name: "Jane Citizen", links } }));
    expect(text).not.toMatch(/\w-\n\w/);
    for (const link of links) expect(text.replace(/\n/g, " ")).toContain(link.url.replace("https://", ""));
  });

  it("never splits a bullet from its text, or a role's title from what follows, across pages", async () => {
    for (const [roles, bullets, length] of [
      [6, 6, 180],
      [9, 5, 120],
      [12, 4, 240],
    ]) {
      const pages = pdfPagesText(await renderCvPdf(long(roles, bullets, length)));
      expect(pages.length).toBeGreaterThan(1);
      for (const page of pages.slice(0, -1)) {
        // The footer ("Page N of M") is drawn last; look at the content before it.
        const lines = page.split("\n").filter((line) => line.trim() && !/^Page \d+ of \d+$/.test(line));
        const last = lines.at(-1)!;
        expect(last).not.toBe("•");
        // Nor a role's heading (title, or the employer line under it) without any of its bullets.
        expect(last).not.toMatch(/^Senior Developer \d+$/);
        expect(last).not.toMatch(/^Employer \d+$/);
      }
    }
    // The case seen in a real 2-page CV: 7 roles of 5 one-line bullets.
    const pages = pdfPagesText(await renderCvPdf(long(7, 5, 90)));
    for (const page of pages.slice(0, -1)) {
      const lines = page.split("\n").filter((line) => line.trim() && !/^Page \d+ of \d+$/.test(line));
      expect(lines.at(-1)).not.toMatch(/^(Senior Developer|Employer) \d+$/);
    }
  });

  it("numbers the pages of a long CV", async () => {
    const long: Profile = {
      basics: { name: "Jane Citizen" },
      work: Array.from({ length: 10 }, (_, i) => ({
        employer: `Employer ${i + 1}`,
        position: "Engineer",
        start: "2010",
        end: "2011",
        highlights: Array.from({ length: 10 }, (_, j) => `Did a substantial and well-described thing number ${j + 1} for this employer.`),
      })),
    };
    const pdf = await renderCvPdf(long);
    const pages = pdfPageCount(pdf);
    expect(pages).toBeGreaterThan(1);
    expect(pdfText(pdf)).toContain(`Page 1 of ${pages}`);
  });
});

describe("renderCoverLetterPdf", () => {
  const letter = {
    job: { title: "Senior Front-end Engineer", employer: "Brightpath" },
    recipient: "Priya Shah",
    greeting: "Dear Priya,",
    paragraphs: ["I'm applying for the Senior Front-end Engineer role.", "At Acme Lending I led the React rebuild of the loan portal."],
    closing: "Kind regards,",
  };

  it("prints the letterhead from the profile, the date, the letter and the name to sign off", async () => {
    const pdf = await renderCoverLetterPdf(cv.basics, letter, "9 October 2026");
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const text = pdfText(pdf).replace(/\s+/g, " ");
    for (const expected of [
      "Jane Citizen",
      "Sydney, NSW · jane@example.com",
      "github.com/jane",
      "9 October 2026",
      "Priya Shah",
      "Brightpath",
      "Re: Senior Front-end Engineer · Brightpath",
      "Dear Priya,",
      "At Acme Lending I led the React rebuild of the loan portal.",
      "Kind regards,",
    ]) {
      expect(text).toContain(expected);
    }
    // Signed with the profile's name after the closing.
    expect(text.indexOf("Jane Citizen", text.indexOf("Kind regards,"))).toBeGreaterThan(0);
    expect(pdfPageCount(pdf)).toBe(1);
  });

  it("runs a long letter onto a second page without failing", async () => {
    const paragraphs = Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1}: ${"a well-described piece of relevant work ".repeat(45)}`.slice(0, 2000));
    const pdf = await renderCoverLetterPdf(cv.basics, { ...letter, paragraphs }, "9 October 2026");
    expect(pdfPageCount(pdf)).toBeGreaterThan(1);
  });
});
