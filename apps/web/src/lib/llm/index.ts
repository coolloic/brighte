// Public API of the LLM layer that is safe anywhere, the browser included: types and pure helpers.
// The server-only part (provider clients, registry, model catalog) is in ./server.

export { createModelCatalog, defaultModel, type ModelCatalog, type ModelCatalogOptions } from "./model-catalog";
export { DEFAULT_MODEL_PATTERNS, isAllowedModel, parseModelPatterns, type ModelPatterns } from "./model-patterns";
export {
  EFFORT_LEVELS,
  IMAGE_MEDIA_TYPES,
  PROVIDER_IDS,
  modelKey,
  type Attachment,
  type Effort,
  type ImageMediaType,
  type ChatRequest,
  type ChatTurn,
  type LlmClient,
  type ModelInfo,
  type ModelOption,
  type ProviderId,
} from "./types";
