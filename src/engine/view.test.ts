import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { newState, setZones } from './testkit';
import { viewFor } from './view';

describe('viewFor', () => {
  it('shows your hand and only counts for opponents', () => {
    const s = newState();
    setZones(s, 0, { hand: ['copper', 'estate'], deck: ['gold'], discard: ['silver', 'duchy'], inPlay: [] });
    // Witch is not in TEST_KINGDOM, so it can only leak into the view through p1's hand.
    setZones(s, 1, { hand: ['witch', 'witch', 'witch'], deck: [], discard: [], inPlay: [] });
    const v = viewFor(s, 'p0');
    expect(v.you).toBe(0);
    expect(v.hand).toEqual(['copper', 'estate']);
    expect(v.players[0]).toEqual({
      id: 'p0', name: 'P0', handCount: 2, deckCount: 1, discardCount: 2, discardTop: 'duchy', inPlay: [],
    });
    expect(v.players[1]).toMatchObject({ handCount: 3, discardTop: null });
    expect(JSON.stringify(v)).not.toContain('witch');
    expect(v.supply.copper).toBe(s.supply.copper);
  });

  it('shows a prompt only to the player who must answer it', () => {
    const s = newState({ players: 3 });
    setZones(s, 0, { hand: ['militia'], deck: [], discard: [] });
    setZones(s, 1, { hand: ['gold', 'gold', 'gold', 'gold', 'gold'], deck: [], discard: [] });
    const g = new Game(s);
    g.apply('p0', { type: 'playAction', handIndex: 0 });

    const mine = viewFor(g.state, 'p1');
    expect(mine.prompt).toMatchObject({ kind: 'chooseCards', player: 1 });
    expect(mine.waitingOn).toBeNull();

    const theirs = viewFor(g.state, 'p0');
    expect(theirs.prompt).toBeNull();
    expect(theirs.waitingOn).toEqual({ player: 1, message: 'Discard 2 card(s), down to 3' });

    const uninvolved = viewFor(g.state, 'p2');
    expect(uninvolved.prompt).toBeNull();
    expect(uninvolved.waitingOn).toEqual({ player: 1, message: 'Discard 2 card(s), down to 3' });
  });

  it('shows Sentry\'s looked-at cards only to the player looking', () => {
    const s = newState();
    // Witch is not in TEST_KINGDOM, so it can only leak through the prompt.
    setZones(s, 0, { hand: ['sentry'], deck: ['copper', 'witch', 'estate', 'copper'], discard: [] });
    const g = new Game(s);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(viewFor(g.state, 'p0').prompt).toMatchObject({ kind: 'chooseOption', cards: ['witch'] });
    expect(JSON.stringify(viewFor(g.state, 'p1'))).not.toContain('witch');
  });

  it('returns a copy that cannot change the game', () => {
    const s = newState();
    const v = viewFor(s, 'p0');
    v.hand.push('gold');
    v.supply.copper = 0;
    expect(s.players[0].hand).toHaveLength(5);
    expect(s.supply.copper).toBe(46);
  });

  it('rejects unknown players', () => {
    expect(() => viewFor(newState(), 'zz')).toThrow('Unknown player: zz');
  });
});
