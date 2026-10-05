import { cvPdfErrorMessage, profileFilename, type CvActions, type CvPdfErrorBody, type CvSource } from "@/lib/cv-pdf";

/** Saves a blob under a file name: a temporary object URL and a clicked <a download>. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Let the download start before the URL goes.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The file name from Content-Disposition (filename*= first, then filename=). */
function filenameOf(response: Response, fallback: string) {
  const header = response.headers.get("content-disposition") ?? "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? fallback;
}

async function fetchPdf(source: CvSource): Promise<{ blob: Blob; filename: string } | { error: string }> {
  let response: Response;
  try {
    response = await fetch("/api/cv-pdf", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(source) });
  } catch {
    return { error: cvPdfErrorMessage({ code: "RENDER_FAILED" }) };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ code: "RENDER_FAILED" }))) as CvPdfErrorBody;
    return { error: cvPdfErrorMessage(body) };
  }
  return { blob: await response.blob(), filename: filenameOf(response, "CV.pdf") };
}

/** The chat page's CV actions (browser only). */
export const cvActions: CvActions = {
  async downloadPdf(source) {
    const result = await fetchPdf(source);
    if ("error" in result) return result.error;
    saveBlob(result.blob, result.filename);
    return undefined;
  },
  async previewPdf(source) {
    const result = await fetchPdf(source);
    if ("error" in result) return result;
    return { url: URL.createObjectURL(new Blob([result.blob], { type: "application/pdf" })) };
  },
  saveProfile(profile) {
    saveBlob(new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" }), profileFilename(profile));
  },
};
