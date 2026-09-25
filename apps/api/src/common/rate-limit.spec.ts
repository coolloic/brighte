import { BACKOFF_RESET_MS, MAX_BLOCK_MS, RateLimitBackoff } from './rate-limit.js';

const BASE = 60_000;

describe('RateLimitBackoff', () => {
  let now: number;
  let backoff: RateLimitBackoff;
  // A block as the guard reports it: every blocked request calls recordBlock with the time left.
  const block = (key = 'ip:register') => {
    const ms = backoff.blockDuration(key, BASE);
    backoff.recordBlock(key, ms / 1000);
    return ms;
  };

  beforeEach(() => {
    now = 1_000_000;
    backoff = new RateLimitBackoff(() => now);
  });

  it('doubles each new block: 60s, 120s, 240s', () => {
    expect(block()).toBe(60_000);
    now += 60_001;
    expect(block()).toBe(120_000);
    now += 120_001;
    expect(block()).toBe(240_000);
  });

  it('counts a block once, however many requests arrive while it lasts', () => {
    expect(block()).toBe(60_000);
    now += 10_000;
    backoff.recordBlock('ip:register', 50); // another request during the same block
    now += 50_001;
    expect(backoff.blockDuration('ip:register', BASE)).toBe(120_000);
  });

  it('never blocks longer than the cap', () => {
    for (let i = 0; i < 10; i++) {
      const ms = block();
      expect(ms).toBeLessThanOrEqual(MAX_BLOCK_MS);
      now += ms + 1;
    }
    expect(backoff.blockDuration('ip:register', BASE)).toBe(MAX_BLOCK_MS);
  });

  it('starts again from the base block after a quiet period', () => {
    block();
    now += 60_001;
    block();
    now += 120_000 + BACKOFF_RESET_MS + 1;
    expect(backoff.blockDuration('ip:register', BASE)).toBe(60_000);
  });

  it('keeps clients and operations apart', () => {
    block('a:register');
    now += 60_001;
    expect(backoff.blockDuration('a:register', BASE)).toBe(120_000);
    expect(backoff.blockDuration('b:register', BASE)).toBe(60_000);
    expect(backoff.blockDuration('a:login', BASE)).toBe(60_000);
  });
});
