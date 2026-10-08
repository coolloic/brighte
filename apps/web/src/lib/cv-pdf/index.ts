// Public API of the CV PDF feature that is safe anywhere, the browser included: filenames, the
// character check and error copy. The renderer and the route's logic are in ./server.
export { printable, unsupportedCharacters } from "./characters";
export { cvPdfErrorMessage, type CvPdfErrorBody, type CvPdfErrorCode } from "./errors";
export { coverLetterFilename, cvFilename, profileFilename } from "./filenames";
export type { CvActions, CvSource } from "./actions";
