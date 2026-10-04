// Server-only public API of the LLM layer: the provider clients (they hold the API keys) behind the
// registry, and the model catalog. Importing this from a Client Component fails the build.
import "server-only";

export { modelCatalog } from "./catalog";
export { configuredClients, getClient } from "./registry";
