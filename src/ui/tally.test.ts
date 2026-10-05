import { describe, it, expect } from 'vitest';
import type { GameResult } from '../engine/types';
import { stepDelay, tallySteps } from './tally';

const result: GameResult = {
  winners: ['a'],
  scores: [
    { playerId: 'a', name: 'A', vp: 13, turns: 10, breakdown: { province: { count: 2, vp: 12 }, estate: { count: 2, vp: 2 }, curse: { count: 1, vp: -1 } } },
    { playerId: 'b', name: 'B', vp: 4, turns: 10, breakdown: { gardens: { count: 1, vp: 3 }, estate: { count: 1, vp: 1 } } },
  ],
};

describe('tallySteps', () => {
  it('counts one card at a time, round-robin, highest first, curses last', () => {
    expect(tallySteps(result).map((s) => [s.player, s.card, s.points])).toEqual([
      [0, 'province', 6], [1, 'gardens', 3],
      [0, 'province', 6], [1, 'estate', 1],
      [0, 'estate', 1],
      [0, 'estate', 1],
      [0, 'curse', -1],
    ]);
  });

  it('keeps running totals that end at each player\'s score', () => {
    const steps = tallySteps(result);
    for (const [i, s] of result.scores.entries()) {
      const mine = steps.filter((x) => x.player === i);
      expect(mine.at(-1)!.total).toBe(s.vp);
    }
    expect(steps[2].total).toBe(12);
  });

  it('is empty when nobody owns a VP card', () => {
    expect(tallySteps({ winners: ['a'], scores: [{ playerId: 'a', name: 'A', vp: 0, turns: 1, breakdown: {} }] })).toEqual([]);
  });
});

describe('stepDelay', () => {
  it('speeds up and keeps a 6–8 s budget for typical games', () => {
    expect(stepDelay(0, 40)).toBeGreaterThan(stepDelay(39, 40));
    const total = Array.from({ length: 40 }, (_, i) => stepDelay(i, 40)).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(6000);
    expect(total).toBeLessThanOrEqual(8000);
  });
});
