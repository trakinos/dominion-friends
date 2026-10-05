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

const score = (playerId: string, vp: number, breakdown: GameResult['scores'][number]['breakdown']) =>
  ({ playerId, name: playerId.toUpperCase(), vp, turns: 10, breakdown });

describe('tallySteps edge cases', () => {
  it('counts a curses-only player down to a negative total', () => {
    const steps = tallySteps({ winners: ['b'], scores: [score('a', -3, { curse: { count: 3, vp: -3 } }), score('b', 1, { estate: { count: 1, vp: 1 } })] });
    const mine = steps.filter((s) => s.player === 0);
    expect(mine.map((s) => s.total)).toEqual([-1, -2, -3]);
    expect(mine.every((s) => s.card === 'curse' && s.points === -1)).toBe(true);
  });

  it('is empty when every player has an empty breakdown', () => {
    expect(tallySteps({ winners: ['a', 'b', 'c'], scores: [score('a', 0, {}), score('b', 0, {}), score('c', 0, {})] })).toEqual([]);
  });

  it('counts each Gardens at vp / count', () => {
    const steps = tallySteps({ winners: ['a'], scores: [score('a', 8, { gardens: { count: 2, vp: 8 } })] });
    expect(steps.map((s) => [s.card, s.points, s.total])).toEqual([['gardens', 4, 4], ['gardens', 4, 8]]);
  });

  it('round-robins across four players, skipping those who run out', () => {
    const steps = tallySteps({
      winners: ['a'],
      scores: [
        score('a', 3, { estate: { count: 3, vp: 3 } }),
        score('b', 0, {}),
        score('c', 6, { province: { count: 1, vp: 6 } }),
        score('d', 5, { duchy: { count: 1, vp: 3 }, estate: { count: 2, vp: 2 } }),
      ],
    });
    expect(steps.map((s) => [s.player, s.card])).toEqual([
      [0, 'estate'], [2, 'province'], [3, 'duchy'],
      [0, 'estate'], [3, 'estate'],
      [0, 'estate'], [3, 'estate'],
    ]);
    expect(steps.filter((s) => s.player === 3).at(-1)!.total).toBe(5);
  });
});

describe('stepDelay bounds', () => {
  it('stays within [90, 650] for a single step', () => {
    const d = stepDelay(0, 1);
    expect(d).toBeGreaterThanOrEqual(90);
    expect(d).toBeLessThanOrEqual(650);
  });

  it('stays within [90, 650] for very large and tiny counts', () => {
    for (const count of [0, 1, 2, 3, 500, 10_000]) {
      for (const i of [0, Math.floor(count / 2), Math.max(0, count - 1)]) {
        const d = stepDelay(i, count);
        expect(d, `stepDelay(${i}, ${count})`).toBeGreaterThanOrEqual(90);
        expect(d, `stepDelay(${i}, ${count})`).toBeLessThanOrEqual(650);
      }
    }
  });
});
