import { describe, it, expect } from 'vitest';
import { fractionLeft, secondsLeft } from './clock';

const clock = { kind: 'turn' as const, totalMs: 45_000, deadline: 100_000 };

describe('clock helpers', () => {
  it('rounds seconds up and never goes below zero', () => {
    expect(secondsLeft(clock, 100_000 - 44_001)).toBe(45);
    expect(secondsLeft(clock, 100_000 - 9_500)).toBe(10);
    expect(secondsLeft(clock, 100_500)).toBe(0);
  });

  it('gives the fraction of time left between 0 and 1', () => {
    expect(fractionLeft(clock, 100_000 - 45_000)).toBe(1);
    expect(fractionLeft(clock, 100_000 - 22_500)).toBe(0.5);
    expect(fractionLeft(clock, 200_000)).toBe(0);
  });
});
