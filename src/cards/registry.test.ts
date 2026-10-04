import { describe, it, expect } from 'vitest';
import { BASIC_IDS, KINGDOM_IDS, cardVp, getCard, isType } from './registry';

describe('card registry', () => {
  it('has the 7 basic cards and 26 unique kingdom cards', () => {
    expect(BASIC_IDS).toEqual(['copper', 'silver', 'gold', 'estate', 'duchy', 'province', 'curse']);
    expect(KINGDOM_IDS).toHaveLength(26);
    expect(new Set(KINGDOM_IDS).size).toBe(26);
  });

  it('looks up cards by id', () => {
    expect(getCard('smithy')).toMatchObject({ id: 'smithy', cost: 4, types: ['action'] });
    expect(getCard('gold').coins).toBe(3);
    expect(() => getCard('nope')).toThrow('Unknown card: nope');
  });

  it('checks types', () => {
    expect(isType('moat', 'reaction')).toBe(true);
    expect(isType('witch', 'attack')).toBe(true);
    expect(isType('copper', 'action')).toBe(false);
  });

  it('computes victory points', () => {
    expect(cardVp('province', [])).toBe(6);
    expect(cardVp('curse', [])).toBe(-1);
    expect(cardVp('copper', [])).toBe(0);
    expect(cardVp('gardens', Array(25).fill('copper'))).toBe(2);
  });
});
