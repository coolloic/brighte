import type { CoverLetterBlock, Profile, TailoredBlock } from "../chat";

/**
 * What a PDF is made from: the profile, plus a tailored block for a tailored CV, or a cover letter
 * block for a cover letter (its letterhead comes from the profile).
 */
export type CvSource = { profile: Profile; tailored?: TailoredBlock; coverLetter?: CoverLetterBlock };

/** What the chat's CV cards can do: provided by the chat page, used through ChatWindow and ChatBubble. */
export type CvActions = {
  /** Downloads the PDF; resolves to an error message, or undefined when it worked. */
  downloadPdf(source: CvSource): Promise<string | undefined>;
  /** Makes the PDF for a preview: its object URL (the caller revokes it), or an error message. */
  previewPdf(source: CvSource): Promise<{ url: string } | { error: string }>;
  saveProfile(profile: Profile): void;
};
