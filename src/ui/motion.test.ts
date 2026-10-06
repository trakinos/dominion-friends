import { describe, it, expect } from 'vitest';
import { Game } from '../engine/game';
import { answerCards, answerSupply, newState, setZones } from '../engine/testkit';
import type { GameState, Intent } from '../engine/types';
import { viewFor } from '../engine/view';
import { cardMotion } from './motion';

/** Applies the intents as p0 and returns the motion each player sees. */
function motionAfter(state: GameState, ...intents: Intent[]) {
  const before = [viewFor(state, 'p0'), viewFor(state, 'p1')];
  const game = new Game(state);
  for (const intent of intents) expect(game.apply('p0', intent)).toEqual({ ok: true });
  return { mine: cardMotion(before[0], viewFor(state, 'p0')), theirs: cardMotion(before[1], viewFor(state, 'p1')) };
}

const ESTATES = ['estate', 'estate', 'estate', 'estate', 'estate', 'estate'];

describe('cardMotion', () => {
  it('flies cards drawn by an Action in from the deck', () => {
    const state = newState();
    setZones(state, 0, { hand: ['smithy', 'copper', 'copper'], deck: ESTATES, discard: [] });
    const { mine } = motionAfter(state, { type: 'playAction', handIndex: 0 });
    expect(mine.drawn).toEqual([2, 3, 4]);
    expect(mine.flights).toEqual([]);
    expect(mine.deckToDiscard).toBe(0);
  });

  it('discards hand cards chosen for Cellar, then draws their replacements', () => {
    const state = newState();
    setZones(state, 0, { hand: ['cellar', 'estate', 'copper', 'estate'], deck: ['silver', 'gold'], discard: [] });
    const { mine } = motionAfter(state, { type: 'playAction', handIndex: 0 }, answerCards([0, 2]));
    expect(mine.flights.map((f) => [f.card, f.from, f.to])).toEqual([
      ['estate', 'hand', 'discard'],
      ['estate', 'hand', 'discard'],
    ]);
    expect(mine.drawn).toHaveLength(2);
  });

  it('does not discard cards that were trashed', () => {
    const state = newState();
    setZones(state, 0, { hand: ['chapel', 'estate', 'copper'], deck: ESTATES, discard: [] });
    const { mine } = motionAfter(state, { type: 'playAction', handIndex: 0 }, answerCards([0, 1]));
    expect(mine.flights).toEqual([]);
    expect(mine.drawn).toEqual([]);
  });

  it('cleans up the play area and the hand into the discard pile, then draws five', () => {
    const state = newState();
    setZones(state, 0, { hand: ['copper', 'estate'], inPlay: ['village', 'silver'], deck: ESTATES, discard: [] });
    state.turn.phase = 'buy';
    const { mine, theirs } = motionAfter(state, { type: 'endPhase' });
    expect(mine.flights.map((f) => [f.card, f.from, f.to, f.player])).toEqual([
      ['village', 'play', 'discard', 0],
      ['silver', 'play', 'discard', 0],
      ['copper', 'hand', 'discard', 0],
      ['estate', 'hand', 'discard', 0],
    ]);
    expect(mine.drawn).toEqual([0, 1, 2, 3, 4]);
    expect(mine.deckToDiscard).toBe(0);
    // The other player sees the play area go to the active player's discard pile, and nothing of their own move.
    expect(theirs.flights.map((f) => [f.card, f.from, f.player])).toEqual([
      ['village', 'play', 0],
      ['silver', 'play', 0],
    ]);
    expect(theirs.drawn).toEqual([]);
  });

  it('draws across a reshuffle without inventing discards from the deck', () => {
    const state = newState();
    setZones(state, 0, { hand: ['copper'], inPlay: [], deck: ['estate'], discard: ESTATES });
    state.turn.phase = 'buy';
    const { mine } = motionAfter(state, { type: 'endPhase' });
    expect(mine.drawn).toHaveLength(5);
    expect(mine.deckToDiscard).toBe(0);
  });

  it('does not treat a bought card as discarded from the deck', () => {
    const state = newState();
    setZones(state, 0, { hand: [], inPlay: [], deck: ESTATES, discard: [] });
    state.turn.phase = 'buy';
    state.turn.coins = 3;
    const { mine, theirs } = motionAfter(state, { type: 'buy', card: 'silver' });
    expect(mine).toEqual({ drawn: [], flights: [], deckToDiscard: 0, bought: { card: 'silver', player: 0 } });
    expect(theirs.bought).toEqual({ card: 'silver', player: 0 });
  });

  it('does not take a gain into your hand for a buy', () => {
    const state = newState({ kingdom: ['mine', 'chapel', 'moat', 'village', 'workshop', 'militia', 'smithy', 'festival', 'laboratory', 'market'] });
    setZones(state, 0, { hand: ['mine', 'copper'], inPlay: [], deck: ESTATES, discard: [] });
    const { mine } = motionAfter(state, { type: 'playAction', handIndex: 0 }, answerCards([0]), answerSupply('silver'));
    expect(mine.bought).toBeNull();
    expect(mine.drawn).toEqual([]);
  });

  it('flies a card discarded from the deck (Vassal) onto the discard pile', () => {
    const state = newState({ kingdom: ['vassal', 'chapel', 'moat', 'village', 'workshop', 'militia', 'smithy', 'festival', 'laboratory', 'market'] });
    setZones(state, 0, { hand: ['vassal'], inPlay: [], deck: ESTATES, discard: [] });
    const { mine } = motionAfter(state, { type: 'playAction', handIndex: 0 });
    expect(mine.deckToDiscard).toBe(1);
    expect(mine.flights).toEqual([]);
  });
});
