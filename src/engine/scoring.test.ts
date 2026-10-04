import { describe, it, expect } from 'vitest';
import { computeResult, isGameOver, scorePlayer } from './scoring';
import { newState, setZones } from './testkit';

describe('scoring', () => {
  it('counts VP across every zone with a breakdown', () => {
    const s = newState();
    setZones(s, 0, { deck: ['estate', 'duchy'], hand: ['province', 'curse', 'copper'], discard: ['estate'], inPlay: [] });
    const score = scorePlayer(s.players[0]);
    expect(score.vp).toBe(1 + 3 + 6 - 1 + 1);
    expect(score.breakdown.estate).toEqual({ count: 2, vp: 2 });
    expect(score.breakdown.curse).toEqual({ count: 1, vp: -1 });
    expect(score.breakdown.copper).toBeUndefined();
  });

  it('scores Gardens by deck size', () => {
    const s = newState();
    setZones(s, 0, { deck: Array(20).fill('copper'), hand: ['gardens', 'gardens'], discard: [], inPlay: [] });
    expect(scorePlayer(s.players[0]).vp).toBe(4);
  });

  it('detects the end of the game', () => {
    const s = newState();
    expect(isGameOver(s)).toBe(false);
    s.supply.village = 0;
    s.supply.smithy = 0;
    expect(isGameOver(s)).toBe(false);
    s.supply.curse = 0;
    expect(isGameOver(s)).toBe(true);
    const t = newState();
    t.supply.province = 0;
    expect(isGameOver(t)).toBe(true);
  });

  it('picks winners by VP, then fewer turns, else shared', () => {
    const s = newState();
    setZones(s, 0, { deck: ['province'], hand: [], discard: [], inPlay: [] });
    setZones(s, 1, { deck: ['duchy'], hand: [], discard: [], inPlay: [] });
    expect(computeResult(s).winners).toEqual(['p0']);

    setZones(s, 1, { deck: ['province'], hand: [], discard: [], inPlay: [] });
    s.players[0].turnsTaken = 2;
    s.players[1].turnsTaken = 1;
    expect(computeResult(s).winners).toEqual(['p1']);

    s.players[1].turnsTaken = 2;
    expect(computeResult(s).winners).toEqual(['p0', 'p1']);
  });
});
