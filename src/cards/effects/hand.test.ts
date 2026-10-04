import { describe, it, expect } from 'vitest';
import { Game } from '../../engine/game';
import { answerCards, answerOption, answerSupply, newState, setZones } from '../../engine/testkit';
import type { CardId } from '../../engine/types';

const ESTATES: CardId[] = ['estate', 'estate', 'estate', 'estate'];

function play(hand: CardId[], deck: CardId[], discard: CardId[] = []): Game {
  const state = newState();
  setZones(state, 0, { hand, deck, discard });
  const g = new Game(state);
  expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({ ok: true });
  return g;
}

describe('Cellar', () => {
  it('discards chosen cards and draws that many', () => {
    const g = play(['cellar', 'estate', 'estate', 'copper', 'copper'], ['silver', 'silver', 'gold']);
    expect(g.state.turn.actions).toBe(1);
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', min: 0, max: 4 });
    g.apply('p0', answerCards([0, 1]));
    expect(g.state.players[0].hand).toEqual(['copper', 'copper', 'silver', 'silver']);
    expect(g.state.players[0].discard).toEqual(['estate', 'estate']);
  });
});

describe('Moat', () => {
  it('draws 2 cards when played', () => {
    const g = play(['moat', ...ESTATES], ['gold', 'gold']);
    expect(g.state.players[0].hand).toHaveLength(6);
  });
});

describe('Merchant', () => {
  it('adds $1 per Merchant to the first Silver only', () => {
    const g = play(['merchant', 'merchant', 'silver', 'silver', 'copper'], ['estate', 'estate']);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    g.apply('p0', { type: 'playAllTreasures' });
    expect(g.state.turn.coins).toBe(2 + 2 + 1 + 2);
  });
});

describe('Council Room', () => {
  it('draws 4, +1 Buy, and each other player draws 1', () => {
    const g = play(['council_room', ...ESTATES], ['copper', 'copper', 'copper', 'copper']);
    expect(g.state.players[0].hand).toHaveLength(8);
    expect(g.state.turn.buys).toBe(2);
    expect(g.state.players[1].hand).toHaveLength(6);
  });
});

describe('Moneylender', () => {
  it('may trash a Copper for +$3', () => {
    const g = play(['moneylender', 'copper', 'estate', 'estate'], []);
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', selectable: [0], min: 0, max: 1 });
    g.apply('p0', answerCards([0]));
    expect(g.state.trash).toEqual(['copper']);
    expect(g.state.turn.coins).toBe(3);
  });

  it('does nothing when declined', () => {
    const g = play(['moneylender', 'copper', 'estate'], []);
    g.apply('p0', answerCards([]));
    expect(g.state.trash).toEqual([]);
    expect(g.state.turn.coins).toBe(0);
  });

  it('does not prompt without a Copper', () => {
    const g = play(['moneylender', ...ESTATES], []);
    expect(g.state.pending).toBeNull();
  });
});

describe('Poacher', () => {
  it('discards a card per empty Supply pile', () => {
    const state = newState();
    state.supply.cellar = 0;
    state.supply.chapel = 0;
    setZones(state, 0, { hand: ['poacher', 'estate', 'estate', 'copper', 'copper'], deck: ['gold'], discard: [] });
    const g = new Game(state);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.turn).toMatchObject({ actions: 1, coins: 1 });
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', min: 2, max: 2 });
    g.apply('p0', answerCards([0, 1]));
    expect(g.state.players[0].discard).toEqual(['estate', 'estate']);
  });

  it('does not prompt with no empty piles', () => {
    const g = play(['poacher', ...ESTATES], ['gold']);
    expect(g.state.pending).toBeNull();
  });
});

describe('Workshop', () => {
  it('gains a card costing up to $4', () => {
    const g = play(['workshop', ...ESTATES], []);
    const pending = g.state.pending;
    expect(pending?.kind).toBe('chooseSupply');
    if (pending?.kind !== 'chooseSupply') return;
    expect(pending.piles).toContain('village');
    expect(pending.piles).toContain('silver');
    expect(pending.piles).not.toContain('festival');
    expect(pending.piles).not.toContain('gold');
    g.apply('p0', answerSupply('village'));
    expect(g.state.players[0].discard).toEqual(['village']);
    expect(g.state.supply.village).toBe(9);
  });
});

describe('Harbinger', () => {
  it('may put a card from the discard pile onto the deck', () => {
    const g = play(['harbinger', ...ESTATES], ['copper'], ['gold', 'estate']);
    expect(g.state.turn.actions).toBe(1);
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', cards: ['gold', 'estate'], min: 0, max: 1 });
    g.apply('p0', answerCards([0]));
    expect(g.state.players[0].deck[0]).toBe('gold');
    expect(g.state.players[0].discard).toEqual(['estate']);
  });
});

describe('Vassal', () => {
  it('may play a discarded Action card', () => {
    const g = play(['vassal', ...ESTATES], ['village', 'copper']);
    expect(g.state.turn.coins).toBe(2);
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', player: 0, cards: ['village'] });
    g.apply('p0', answerOption(0));
    expect(g.state.players[0].inPlay).toEqual(['vassal', 'village']);
    expect(g.state.players[0].discard).toEqual([]);
    expect(g.state.players[0].hand).toContain('copper');
    expect(g.state.turn.actions).toBe(2);
  });

  it('just discards a non-Action card', () => {
    const g = play(['vassal', ...ESTATES], ['gold']);
    expect(g.state.players[0].discard).toEqual(['gold']);
    expect(g.state.pending).toBeNull();
  });
});
