import { createHash } from 'node:crypto';

// Text to vectors for the chat's recall. The local model runs in this process: nothing leaves the
// machine and there is no key. EMBEDDINGS=fake swaps in a deterministic stand-in for tests.

/** all-MiniLM-L6-v2's vector size; my_data_chunks.embedding is vector(384). */
export const EMBEDDING_DIMENSIONS = 384;

export abstract class Embedder {
  /** One normalised vector per text, in order. */
  abstract embed(texts: string[]): Promise<number[][]>;
}

type FeatureExtractor = (texts: string[], options: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

/**
 * all-MiniLM-L6-v2 through transformers.js (ONNX Runtime). The model (~25 MB) is downloaded on first
 * use to EMBEDDINGS_CACHE_DIR (default: the package's own cache) and loaded once per process.
 */
export class LocalEmbedder extends Embedder {
  #extractor?: Promise<FeatureExtractor>;

  private extractor(): Promise<FeatureExtractor> {
    this.#extractor ??= (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      if (process.env.EMBEDDINGS_CACHE_DIR) env.cacheDir = process.env.EMBEDDINGS_CACHE_DIR;
      return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' });
    })();
    // A failed load (e.g. offline on first use) is retried next time instead of being kept.
    this.#extractor.catch(() => (this.#extractor = undefined));
    return this.#extractor;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extract = await this.extractor();
    return (await extract(texts, { pooling: 'mean', normalize: true })).tolist();
  }
}

/**
 * For tests: a bag of words hashed into 384 buckets, normalised. Deterministic and instant, and texts
 * sharing words come out close, so search order can still be tested.
 */
export class FakeEmbedder extends Embedder {
  embed(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map(fakeVector));
  }
}

function fakeVector(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    vector[createHash('sha256').update(word).digest().readUInt32BE(0) % EMBEDDING_DIMENSIONS] += 1;
  }
  const length = Math.hypot(...vector);
  // An empty text still needs a valid vector (pgvector's cosine distance is undefined for zero).
  if (length === 0) vector[0] = 1;
  return length === 0 ? vector : vector.map((value) => value / length);
}

/** The embedder EMBEDDINGS picks: `fake` for tests, else the local model. */
export function createEmbedder(env: Record<string, string | undefined> = process.env): Embedder {
  return env.EMBEDDINGS === 'fake' ? new FakeEmbedder() : new LocalEmbedder();
}
