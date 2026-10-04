import { isAllowedModel, type ModelPatterns } from "./model-patterns";
import { modelKey, type LlmClient, type ModelOption } from "./types";

export type ModelCatalogOptions = {
  /** The providers to ask, called on each refresh (keys are read then). */
  clients: () => LlmClient[];
  patterns: ModelPatterns;
  /** How long a complete list is kept. */
  ttlMs: number;
  /** How long a list is kept when a provider failed, so it is retried soon. */
  retryMs?: number;
  now?: () => number;
};

export type ModelCatalog = {
  /** Models visitors may pick: discovered from each provider, filtered by the patterns. */
  list(): Promise<ModelOption[]>;
  /** The option for a provider and model id, if visitors may pick it. */
  find(provider: string, id: string): Promise<ModelOption | undefined>;
};

/**
 * Asks every configured provider for its models (their models APIs), keeps those the patterns
 * allow, and caches the list. A provider that fails is left out (and logged) until the next retry.
 * Concurrent callers share one refresh.
 */
export function createModelCatalog({ clients, patterns, ttlMs, retryMs = 60_000, now = Date.now }: ModelCatalogOptions): ModelCatalog {
  let cache: { expires: number; options: Promise<ModelOption[]> } | undefined;

  async function load(): Promise<{ options: ModelOption[]; complete: boolean }> {
    const results = await Promise.allSettled(
      clients().map(async (client) =>
        (await client.listModels())
          .filter((model) => isAllowedModel(patterns, client.provider, model.id))
          .map((model): ModelOption => ({ provider: client.provider, providerLabel: client.label, id: model.id, label: model.label })),
      ),
    );
    const options: ModelOption[] = [];
    let complete = true;
    for (const result of results) {
      if (result.status === "fulfilled") options.push(...result.value);
      else {
        complete = false;
        console.error("Listing models failed:", result.reason);
      }
    }
    return { options, complete };
  }

  function list(): Promise<ModelOption[]> {
    if (cache && cache.expires > now()) return cache.options;
    const entry = { expires: Number.POSITIVE_INFINITY, options: Promise.resolve<ModelOption[]>([]) };
    entry.options = load().then(({ options, complete }) => {
      entry.expires = now() + (complete ? ttlMs : retryMs);
      return options;
    });
    cache = entry;
    return entry.options;
  }

  return {
    list,
    async find(provider, id) {
      return (await list()).find((option) => option.provider === provider && option.id === id);
    },
  };
}

/**
 * The picker's starting model: `preferred` ("provider:model"), or the first option that starts with
 * it (so "anthropic:claude-haiku-4-5" finds "claude-haiku-4-5-20251001"), or the first option.
 */
export function defaultModel(options: ModelOption[], preferred: string): ModelOption | undefined {
  return (
    options.find((option) => modelKey(option) === preferred) ?? options.find((option) => modelKey(option).startsWith(preferred)) ?? options[0]
  );
}
