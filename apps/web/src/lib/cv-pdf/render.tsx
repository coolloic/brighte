import { renderToBuffer } from "@react-pdf/renderer";
import type { Profile } from "../chat";
import { CvDocument } from "./CvDocument";

/** The CV as PDF bytes. */
export async function renderCvPdf(cv: Profile): Promise<Buffer> {
  return renderToBuffer(<CvDocument cv={cv} />);
}
