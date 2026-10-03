import "server-only";
import { chatConfig } from "../chat/config";
import { createModelCatalog } from "./model-catalog";
import { parseModelPatterns } from "./model-patterns";
import { configuredClients } from "./registry";

const config = chatConfig();

/** The models visitors may pick, for this server instance: CHAT_MODELS and CHAT_MODELS_CACHE_SECONDS are read at start-up. */
export const modelCatalog = createModelCatalog({
  clients: configuredClients,
  patterns: parseModelPatterns(config.modelPatterns),
  ttlMs: config.modelsCacheSeconds * 1000,
});
