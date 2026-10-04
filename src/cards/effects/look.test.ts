import { describe, it, expect } from 'vitest';
import { Game } from '../../engine/game';
import { answerOption, answerOrder, newState, setZones } from '../../engine/testkit';
import type { CardId } from '../../engine/types';
import { KINGDOM_IDS, getCard } from '../registry';

function play(hand: CardId[], deck: CardId[], discard: CardId[] = []): Game {
  const state = newState();
  setZones(state, 0, { hand, deck, discard });
  const g = new Game(state);
  expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({ ok: true });
  return g;
}

describe('Library', () => {
  it('draws to 7, letting the player set aside Actions', () => {
    const g = play(
      ['library', 'estate', 'estate', 'estate', 'estate'],
      ['village', 'copper', 'smithy', 'copper', 'gold'],
    );
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', cards: ['village'] });
    g.apply('p0', answerOption(0)); // set Village aside
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', cards: ['smithy'] });
    g.apply('p0', answerOption(1)); // keep Smithy
    expect(g.state.pending).toBeNull();
    expect(g.state.players[0].hand).toEqual(['estate', 'estate', 'estate', 'estate', 'copper', 'smithy', 'copper']);
    expect(g.state.players[0].discard).toEqual(['village']);
    expect(g.state.players[0].deck).toEqual(['gold']);
  });

  it('stops when there is nothing left to draw', () => {
    const g = play(['library', 'estate'], ['copper']);
    expect(g.state.players[0].hand).toEqual(['estate', 'copper']);
    expect(g.state.pending).toBeNull();
  });
});

describe('Sentry', () => {
  it('trashes, discards or keeps each of the top 2 cards', () => {
    const g = play(['sentry', 'estate'], ['copper', 'curse', 'gold', 'silver']);
    expect(g.state.turn.actions).toBe(1);
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', cards: ['curse'], options: ['Trash', 'Discard', 'Put back'] });
    g.apply('p0', answerOption(0));
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', cards: ['gold'] });
    g.apply('p0', answerOption(2));
    expect(g.state.pending).toBeNull();
    expect(g.state.trash).toEqual(['curse']);
    expect(g.state.players[0].deck).toEqual(['gold', 'silver']);
  });

  it('lets the player order the kept cards', () => {
    const g = play(['sentry', 'estate'], ['copper', 'gold', 'silver', 'estate']);
    g.apply('p0', answerOption(2));
    g.apply('p0', answerOption(2));
    expect(g.state.pending).toMatchObject({ kind: 'orderCards', cards: ['gold', 'silver'] });
    g.apply('p0', answerOrder([1, 0]));
    expect(g.state.players[0].deck).toEqual(['silver', 'gold', 'estate']);
  });
});

describe('effect coverage', () => {
  it('every kingdom Action card has an effect', () => {
    const missing = KINGDOM_IDS.filter((id) => getCard(id).types.includes('action') && !getCard(id).play);
    expect(missing).toEqual([]);
  });
});

describe('reshuffles during look effects', () => {
  it('Library: set-aside Actions stay out of the reshuffled deck and end in the discard pile', () => {
    const g = play(['library'], ['village'], Array(7).fill('copper'));
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', cards: ['village'] });
    g.apply('p0', answerOption(0));
    expect(g.state.pending).toBeNull();
    const me = g.state.players[0];
    expect(me.hand).toEqual(Array(7).fill('copper'));
    expect(me.deck).toEqual([]);
    expect(me.discard).toEqual(['village']);
  });

  it('Sentry: reshuffles the discard pile when only 1 card is left in the deck', () => {
    const g = play(['sentry', 'estate'], ['copper'], ['silver', 'silver', 'silver']);
    // Draws the copper, then looks at 2 cards from the reshuffled discard pile.
    expect(g.state.players[0].hand).toEqual(['estate', 'copper']);
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', cards: ['silver'] });
    g.apply('p0', answerOption(1));
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', cards: ['silver'] });
    g.apply('p0', answerOption(2));
    expect(g.state.pending).toBeNull();
    const me = g.state.players[0];
    expect(me.deck).toEqual(['silver', 'silver']);
    expect(me.discard).toEqual(['silver']);
  });

  it('Sentry: discards looked cards', () => {
    const g = play(['sentry', 'estate'], ['copper', 'gold', 'province', 'silver']);
    g.apply('p0', answerOption(1));
    g.apply('p0', answerOption(1));
    expect(g.state.pending).toBeNull();
    const me = g.state.players[0];
    expect(me.discard).toEqual(['gold', 'province']);
    expect(me.deck).toEqual(['silver']);
    expect(g.state.trash).toEqual([]);
  });
});
