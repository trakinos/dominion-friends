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

describe('clock helpers with a stale `now`', () => {
  // A new clock can arrive while the tab isn't painting: the last rendered `now`
  // is then older than the moment the deadline was computed from.
  const stale = 100_000 - 45_000 - 3_000;

  it('never shows more seconds than the total', () => {
    expect(secondsLeft(clock, stale)).toBeLessThanOrEqual(Math.ceil(clock.totalMs / 1000));
    expect(secondsLeft(clock, stale)).toBe(45);
  });

  it('never shows more than a full bar', () => {
    expect(fractionLeft(clock, stale)).toBe(1);
  });

  it('caps a 30 s response clock at 30', () => {
    const response = { kind: 'response' as const, totalMs: 30_000, deadline: 50_000 };
    expect(secondsLeft(response, 0)).toBe(30);
    expect(fractionLeft(response, 0)).toBe(1);
  });
});
