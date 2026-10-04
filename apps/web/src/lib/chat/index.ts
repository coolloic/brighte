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
