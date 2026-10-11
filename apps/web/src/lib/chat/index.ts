// Public API of the chat feature that is safe anywhere, the browser included: message rules and
// error copy, shared by the chat page and the chat route. The server-only part is in ./server.

export { chatErrorMessage, type ChatErrorBody, type ChatErrorCode } from "./chat-error";
export {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_TYPES_LABEL,
  attachmentBytes,
  fitAttachments,
  formatBytes,
  readAttachment,
  totalAttachmentBytes,
  type AttachmentLimits,
  type ReadAttachmentResult,
} from "./attachments";
export { chatRequestSchema, MAX_HISTORY, messageError, recentHistory, type ChatRequestBody, type ChatRequestLimits } from "./messages";
export { MATCH_BLOCK, matchBlockSchema, parseMatchBlock, type MatchBlock, type MatchItem, type MatchStatus } from "./match-block";
export { blockContents, hasBlock } from "./blocks";
export { PROFILE_BLOCK, parseProfileBlock, profileBlockSchema, type Profile, type ProfileRole } from "./profile-block";
export { parseTailoredBlock, TAILORED_BLOCK, tailoredBlockSchema, type TailoredBlock, type TailoredBullet } from "./tailored-block";
export { COVER_LETTER_BLOCK, coverLetterBlockSchema, parseCoverLetterBlock, type CoverLetterBlock } from "./cover-letter-block";
export { parsePdfBlock, PDF_BLOCK, PDF_DOCUMENT_NAMES, PDF_DOCUMENTS, pdfBlockSchema, type PdfBlock, type PdfDocument } from "./pdf-block";
export { tailorCv, type LeftOut, type RewordedBullet, type TailorFlag, type TailorResult } from "./tailor";
export { dateRange, educationDates, formatDate } from "./cv-format";
export type { RateLimitResult } from "./rate-limit";
export { readJson } from "./read-json";
