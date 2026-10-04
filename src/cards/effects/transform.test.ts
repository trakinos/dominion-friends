import { describe, it, expect } from 'vitest';
import { Game } from '../../engine/game';
import { answerCards, answerSupply, newState, setZones } from '../../engine/testkit';
import type { CardId } from '../../engine/types';

function play(hand: CardId[], deck: CardId[] = []): Game {
  const state = newState({ kingdom: ['cellar', 'chapel', 'moat', 'village', 'workshop', 'militia', 'smithy', 'festival', 'throne_room', 'market'] });
  setZones(state, 0, { hand, deck, discard: [] });
  const g = new Game(state);
  expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({ ok: true });
  return g;
}

function supplyPiles(g: Game): CardId[] {
  const p = g.state.pending;
  if (p?.kind !== 'chooseSupply') throw new Error(`Expected chooseSupply, got ${p?.kind}`);
  return p.piles;
}

describe('Remodel', () => {
  it('trashes a card and gains one costing up to $2 more', () => {
    const g = play(['remodel', 'estate', 'copper', 'copper', 'copper']);
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', min: 1, max: 1 });
    g.apply('p0', answerCards([0]));
    expect(g.state.trash).toEqual(['estate']);
    expect(supplyPiles(g)).toEqual(expect.arrayContaining(['silver', 'smithy', 'village']));
    expect(supplyPiles(g)).not.toContain('gold');
    expect(supplyPiles(g)).not.toContain('festival');
    g.apply('p0', answerSupply('smithy'));
    expect(g.state.players[0].discard).toEqual(['smithy']);
  });

  it('does nothing with an empty hand', () => {
    const g = play(['remodel']);
    expect(g.state.pending).toBeNull();
  });
});

describe('Mine', () => {
  it('upgrades a Treasure into hand', () => {
    const g = play(['mine', 'copper', 'estate']);
    g.apply('p0', answerCards([0]));
    expect(supplyPiles(g).sort()).toEqual(['copper', 'silver']);
    g.apply('p0', answerSupply('silver'));
    expect(g.state.players[0].hand).toEqual(['estate', 'silver']);
    expect(g.state.trash).toEqual(['copper']);
  });

  it('does not prompt without a Treasure', () => {
    const g = play(['mine', 'estate']);
    expect(g.state.pending).toBeNull();
  });
});

describe('Artisan', () => {
  it('gains a card to hand then topdecks a card', () => {
    const g = play(['artisan', 'estate', 'copper']);
    expect(supplyPiles(g)).toContain('festival');
    expect(supplyPiles(g)).not.toContain('gold');
    g.apply('p0', answerSupply('festival'));
    expect(g.state.players[0].hand).toEqual(['estate', 'copper', 'festival']);
    g.apply('p0', answerCards([0]));
    expect(g.state.players[0].deck[0]).toBe('estate');
    expect(g.state.players[0].hand).toEqual(['copper', 'festival']);
  });
});

describe('Throne Room', () => {
  it('plays an Action twice', () => {
    const g = play(['throne_room', 'smithy', 'copper'], Array(10).fill('estate'));
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', selectable: [0], min: 0, max: 1 });
    g.apply('p0', answerCards([0]));
    expect(g.state.players[0].hand).toHaveLength(7);
    expect(g.state.players[0].inPlay).toEqual(['throne_room', 'smithy']);
  });

  it('may be declined', () => {
    const g = play(['throne_room', 'smithy']);
    g.apply('p0', answerCards([]));
    expect(g.state.players[0].hand).toEqual(['smithy']);
  });

  it('Throne Room on Throne Room plays two Actions twice each', () => {
    const g = play(['throne_room', 'throne_room', 'village', 'smithy', 'copper'], Array(20).fill('estate'));
    g.apply('p0', answerCards([0])); // the second Throne Room
    expect(g.state.pending).toMatchObject({ cards: ['village', 'smithy', 'copper'] });
    g.apply('p0', answerCards([0])); // Village, twice
    expect(g.state.pending).toMatchObject({ cards: ['smithy', 'copper', 'estate', 'estate'] });
    g.apply('p0', answerCards([0])); // Smithy, twice
    expect(g.state.pending).toBeNull();
    expect(g.state.turn.actions).toBe(4);
    expect(g.state.players[0].hand).toHaveLength(9);
    expect(g.state.players[0].inPlay).toEqual(['throne_room', 'throne_room', 'village', 'smithy']);
  });
});
