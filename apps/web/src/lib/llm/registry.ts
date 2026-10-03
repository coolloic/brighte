import "server-only";
import { AnthropicClient } from "./clients/anthropic";
import { GeminiClient } from "./clients/gemini";
import { OpenAIClient } from "./clients/openai";
import { PROVIDER_IDS, type LlmClient, type ProviderId } from "./types";

// Every provider the app can talk to: the env variable holding its key, and how to build its client.
// Adding a provider = a client in ./clients plus one entry here (and its id in PROVIDER_IDS).
const PROVIDERS: Record<ProviderId, { keyEnv: string; create: (apiKey: string) => LlmClient }> = {
  anthropic: { keyEnv: "ANTHROPIC_API_KEY", create: (apiKey) => new AnthropicClient(apiKey) },
  openai: { keyEnv: "OPENAI_API_KEY", create: (apiKey) => new OpenAIClient(apiKey) },
  gemini: { keyEnv: "GEMINI_API_KEY", create: (apiKey) => new GeminiClient(apiKey) },
};

const clients = new Map<ProviderId, LlmClient>();

/** The provider's client, or undefined when its API key isn't set (the provider is off). */
export function getClient(provider: ProviderId): LlmClient | undefined {
  const { keyEnv, create } = PROVIDERS[provider];
  const apiKey = process.env[keyEnv];
  if (!apiKey) return undefined;
  let client = clients.get(provider);
  if (!client) {
    client = create(apiKey);
    clients.set(provider, client);
  }
  return client;
}

/** Clients for every provider with an API key set. */
export function configuredClients(): LlmClient[] {
  return PROVIDER_IDS.map(getClient).filter((client): client is LlmClient => client !== undefined);
}
