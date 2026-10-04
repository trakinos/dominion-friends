import { describe, it, expect } from 'vitest';
import { drawCards, emptyPileCount } from './zones';
import { newState, setZones } from './testkit';

describe('zones', () => {
  it('draws from the top of the deck', () => {
    const s = newState();
    setZones(s, 0, { deck: ['gold', 'silver', 'copper'], hand: [], discard: [] });
    expect(drawCards(s, 0, 2)).toEqual(['gold', 'silver']);
    expect(s.players[0].hand).toEqual(['gold', 'silver']);
    expect(s.players[0].deck).toEqual(['copper']);
  });

  it('reshuffles the discard pile when the deck runs out', () => {
    const s = newState();
    setZones(s, 0, { deck: ['gold'], hand: [], discard: ['silver', 'silver'] });
    expect(drawCards(s, 0, 3)).toEqual(['gold', 'silver', 'silver']);
    expect(s.players[0].discard).toEqual([]);
    expect(s.players[0].deck).toEqual([]);
  });

  it('stops drawing when deck and discard are both empty', () => {
    const s = newState();
    setZones(s, 0, { deck: ['gold'], hand: [], discard: [] });
    expect(drawCards(s, 0, 3)).toEqual(['gold']);
  });

  it('counts empty supply piles', () => {
    const s = newState();
    expect(emptyPileCount(s)).toBe(0);
    s.supply.village = 0;
    s.supply.smithy = 0;
    expect(emptyPileCount(s)).toBe(2);
  });
});
