// Server-only public API of the CV PDF feature: the renderer and the route's logic.
import "server-only";

export { handleCvPdf, type CvPdfHandlerDeps } from "./handle-cv-pdf";
export { renderCvPdf } from "./render";
