// Which discovered models visitors may pick (CHAT_MODELS). Patterns, not exact versions, so a new
// release of an allowed family shows up by itself: "anthropic:claude-haiku-*" matches the next Haiku.

/**
 * The cheap tier of each provider. Snapshot ids such as "gpt-5-mini-2025-08-07" and variants such
 * as "gpt-4o-mini-tts" don't match "gpt-*-mini", which is intended: only the plain chat models.
 */
export const DEFAULT_MODEL_PATTERNS = "anthropic:claude-haiku-*,openai:gpt-*-mini,openai:gpt-*-nano,gemini:gemini-*-flash,gemini:gemini-*-flash-lite";

type Pattern = { provider: RegExp; model: RegExp };
export type ModelPatterns = { include: Pattern[]; exclude: Pattern[] };

/** "*" matches any characters; everything else is literal. Whole-string match. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`);
}

/**
 * Parses a comma-separated list of `provider:model` globs. A leading "!" excludes, e.g.
 * "openai:*,!openai:*-tts*". Entries without a ":" are ignored.
 */
export function parseModelPatterns(spec: string): ModelPatterns {
  const patterns: ModelPatterns = { include: [], exclude: [] };
  for (const raw of spec.split(",")) {
    const entry = raw.trim();
    const negated = entry.startsWith("!");
    const [provider, model] = (negated ? entry.slice(1) : entry).split(/:(.*)/);
    if (!provider || !model) continue;
    (negated ? patterns.exclude : patterns.include).push({ provider: globToRegExp(provider), model: globToRegExp(model) });
  }
  return patterns;
}

/** True when an include pattern matches and no exclude pattern does. */
export function isAllowedModel({ include, exclude }: ModelPatterns, provider: string, model: string): boolean {
  const matches = (p: Pattern) => p.provider.test(provider) && p.model.test(model);
  return include.some(matches) && !exclude.some(matches);
}
