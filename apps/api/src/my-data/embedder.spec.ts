import { createEmbedder, EMBEDDING_DIMENSIONS, FakeEmbedder, LocalEmbedder } from './embedder.js';

const cosine = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);

describe('FakeEmbedder', () => {
  const embedder = new FakeEmbedder();

  it('gives each text a normalised vector of the model size, the same every time', async () => {
    const [first, again] = await embedder.embed(['Led the React rebuild', 'Led the React rebuild']);
    expect(first).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(Math.hypot(...first)).toBeCloseTo(1);
    expect(again).toEqual(first);
  });

  it('puts texts that share words closer than texts that do not', async () => {
    const [query, near, far] = await embedder.embed(['accessibility audit', 'Ran the accessibility audit for WCAG', 'Mentored two graduates']);
    expect(cosine(query, near)).toBeGreaterThan(cosine(query, far));
  });

  it('still gives a valid vector for text without words', async () => {
    const [vector] = await embedder.embed(['—']);
    expect(Math.hypot(...vector)).toBeCloseTo(1);
  });
});

describe('createEmbedder', () => {
  it('picks the fake for EMBEDDINGS=fake, else the local model', () => {
    expect(createEmbedder({ EMBEDDINGS: 'fake' })).toBeInstanceOf(FakeEmbedder);
    expect(createEmbedder({})).toBeInstanceOf(LocalEmbedder);
  });
});
