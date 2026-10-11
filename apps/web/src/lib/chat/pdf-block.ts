import { z } from "zod";
import { parseJsonBlock } from "./block-schema";

// A "pdf" block: the export tool. When the visitor asks for a PDF in their own words ("download it",
// "export my letter", "PDF please"), the model doesn't write the document again: it names which one
// with this block, and the chat exports the newest valid one of that kind in the conversation,
// through the same checks as the cards' Download PDF button.

/** The code block language that asks for a PDF. */
export const PDF_BLOCK = "pdf";

export const PDF_DOCUMENTS = ["cv", "tailored", "coverletter"] as const;
/** What can be exported: the CV (from the profile), the tailored CV, or the cover letter. */
export type PdfDocument = (typeof PDF_DOCUMENTS)[number];

export const pdfBlockSchema = z.object({ document: z.enum(PDF_DOCUMENTS) });

export type PdfBlock = z.infer<typeof pdfBlockSchema>;

/** The block's JSON, checked. Undefined when it isn't valid, or isn't complete yet while streaming. */
export function parsePdfBlock(code: string): PdfBlock | undefined {
  return parseJsonBlock(code, pdfBlockSchema);
}

/** What the visitor calls each document, e.g. in "There's no cover letter in this chat yet". */
export const PDF_DOCUMENT_NAMES: Record<PdfDocument, string> = { cv: "CV", tailored: "tailored CV", coverletter: "cover letter" };
