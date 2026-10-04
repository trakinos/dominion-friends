import { describe, it, expect } from 'vitest';
import { createRng, nextFloat, nextInt, shuffle } from './rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [nextFloat(a), nextFloat(a), nextFloat(a)];
    const seqB = [nextFloat(b), nextFloat(b), nextFloat(b)];
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds', () => {
    expect(nextFloat(createRng(1))).not.toEqual(nextFloat(createRng(2)));
  });

  it('returns floats in [0, 1) and ints in [0, n)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const f = nextFloat(rng);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = nextInt(rng, 5);
      expect(Number.isInteger(n) && n >= 0 && n < 5).toBe(true);
    }
  });

  it('shuffles into a permutation without mutating the input', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    const out = shuffle(createRng(3), input);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect([...out].sort()).toEqual(input);
  });
});
