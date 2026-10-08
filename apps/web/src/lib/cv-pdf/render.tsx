import { renderToBuffer } from "@react-pdf/renderer";
import type { CoverLetterBlock, Profile } from "../chat";
import { CoverLetterDocument } from "./CoverLetterDocument";
import { CvDocument } from "./CvDocument";

/** The CV as PDF bytes. */
export async function renderCvPdf(cv: Profile): Promise<Buffer> {
  return renderToBuffer(<CvDocument cv={cv} />);
}

/** A cover letter as PDF bytes: the letterhead from the profile's basics, dated `date` (as printed). */
export async function renderCoverLetterPdf(basics: Profile["basics"], letter: CoverLetterBlock, date: string): Promise<Buffer> {
  return renderToBuffer(<CoverLetterDocument basics={basics} letter={letter} date={date} />);
}
