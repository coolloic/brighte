import { z } from "zod";
import { blockContents, type CoverLetterBlock, type Profile } from "@/lib/chat";

// The cover letter judge: a (stronger) model lists each factual claim the letter makes about the
// candidate and says whether the profile supports it. Free text can't be checked mechanically, so
// this is the check on "never invent" for letters. Calibrate it (CALIBRATION below) before trusting it.

export const judgeSchema = z.object({
  claims: z.array(z.object({ claim: z.string(), supported: z.boolean(), reason: z.string() })),
});
export type JudgeVerdict = z.infer<typeof judgeSchema>;

export function judgePrompt(profile: Profile, jobAd: string, letter: CoverLetterBlock): string {
  return `You check cover letters for invented facts. Below are a candidate's profile (the only source of truth about them), the job ad, and a cover letter written for them.

List every factual claim the letter makes about the candidate: experience, roles, employers, skills, tools, achievements, numbers, dates, qualifications, certificates, languages. Leave out opinions, enthusiasm, and statements about the employer or the job.

For each claim, "supported" is true only when the profile states it or it follows directly (e.g. "8 years of React" from roles that add up to that). It is false when the profile doesn't say it, or says something different (a number changed, a skill it doesn't list, a responsibility made bigger). Give a short reason.

Answer with only a fenced code block with the language "json", holding {"claims": [{"claim": "...", "supported": true, "reason": "..."}]}.

Profile:
${JSON.stringify(profile, null, 2)}

Job ad:
${jobAd}

Cover letter:
${letter.paragraphs.join("\n\n")}`;
}

/** The judge's verdict from its reply, or undefined when it isn't valid JSON in the expected shape. */
export function parseVerdict(reply: string): JudgeVerdict | undefined {
  for (const code of [...blockContents(reply, "json"), reply.trim()]) {
    try {
      const result = judgeSchema.safeParse(JSON.parse(code));
      if (result.success) return result.data;
    } catch {
      // Not JSON: try the next candidate.
    }
  }
  return undefined;
}

/** Letters with known answers, for the frontend-senior case's profile: does the judge catch what it should? */
export const CALIBRATION: { name: string; unsupported: number; letter: CoverLetterBlock }[] = [
  {
    name: "fully supported",
    unsupported: 0,
    letter: {
      job: { title: "Senior Front-end Engineer", employer: "Brightpath Fintech" },
      greeting: "Dear Hiring Manager,",
      paragraphs: [
        "I'm applying for the Senior Front-end Engineer role at Brightpath Fintech.",
        "At Acme Lending I led the React and TypeScript rebuild of our customer loan portal, used by 40,000 people a month, and I ran its WCAG 2.1 AA audit, adding automated accessibility checks to CI.",
        "I've also mentored two graduate engineers, and at Globex Insurance I introduced Storybook and a shared component library.",
      ],
      closing: "Kind regards,",
    },
  },
  {
    name: "three invented claims (a team of 12, an AWS certificate, owning deployments)",
    unsupported: 3,
    letter: {
      job: { title: "Senior Front-end Engineer", employer: "Brightpath Fintech" },
      greeting: "Dear Hiring Manager,",
      paragraphs: [
        "I'm applying for the Senior Front-end Engineer role at Brightpath Fintech.",
        "At Acme Lending I led a team of 12 engineers through the React rebuild of our customer loan portal.",
        "I'm also an AWS Certified Solutions Architect, so I'm comfortable owning deployments.",
      ],
      closing: "Kind regards,",
    },
  },
  {
    name: "one changed number (50,000 users, not 40,000)",
    unsupported: 1,
    letter: {
      job: { title: "Senior Front-end Engineer", employer: "Brightpath Fintech" },
      greeting: "Dear Hiring Manager,",
      paragraphs: [
        "I'm applying for the Senior Front-end Engineer role at Brightpath Fintech.",
        "At Acme Lending I led the React and TypeScript rebuild of the customer loan portal, now used by 50,000 people a month.",
        "I ran the portal's WCAG 2.1 AA audit and added automated accessibility checks to CI.",
      ],
      closing: "Kind regards,",
    },
  },
];
