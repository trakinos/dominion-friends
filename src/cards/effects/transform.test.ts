import { describe, it, expect } from 'vitest';
import { Game } from '../../engine/game';
import { answerCards, answerOption, answerSupply, newState, setZones } from '../../engine/testkit';
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

describe('Throne Room interactions', () => {
  const kingdom: CardId[] = ['throne_room', 'militia', 'moat', 'vassal', 'library', 'sentry', 'bandit', 'merchant', 'festival', 'market'];
  const start = (players: number, p0: { hand: CardId[]; deck: CardId[] }) => {
    const state = newState({ kingdom, players });
    setZones(state, 0, { ...p0, discard: [] });
    return { state, g: new Game(state) };
  };

  it('plays Vassal twice, each time discarding the top card and offering to play it', () => {
    const { state, g } = start(2, { hand: ['throne_room', 'vassal', 'copper'], deck: ['festival', 'market', 'copper', 'copper', 'copper'] });
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    g.apply('p0', answerCards([0]));
    expect(state.pending).toMatchObject({ kind: 'chooseOption', cards: ['festival'] });
    g.apply('p0', answerOption(0));
    expect(state.pending).toMatchObject({ kind: 'chooseOption', cards: ['market'] });
    g.apply('p0', answerOption(0));
    expect(state.pending).toBeNull();
    // Vassal 2+2, Festival +2, Market +1.
    expect(state.turn).toMatchObject({ coins: 7, actions: 3, buys: 3 });
    expect(state.players[0].inPlay).toEqual(['throne_room', 'vassal', 'festival', 'market']);
    expect(state.players[0].discard).toEqual([]);
    expect(state.players[0].hand).toEqual(['copper', 'copper']);
  });

  it('plays Vassal twice, leaving the cards in the discard pile when declined', () => {
    const { state, g } = start(2, { hand: ['throne_room', 'vassal'], deck: ['festival', 'market', 'copper'] });
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    g.apply('p0', answerCards([0]));
    g.apply('p0', answerOption(1));
    g.apply('p0', answerOption(1));
    expect(state.pending).toBeNull();
    expect(state.turn.coins).toBe(4);
    expect(state.players[0].discard).toEqual(['festival', 'market']);
  });

  it('gives +$2 on the first Silver only after Throne Room + Merchant', () => {
    const { state, g } = start(2, { hand: ['throne_room', 'merchant', 'silver', 'silver'], deck: ['estate', 'estate'] });
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    g.apply('p0', answerCards([0]));
    expect(state.turn.merchants).toBe(2);
    g.apply('p0', { type: 'playAllTreasures' });
    // Two Silvers ($4) plus $2 from the two Merchants on the first Silver only.
    expect(state.turn.coins).toBe(6);
  });

  it('gives +$2 on the first Silver only after Vassal flips Throne Room into Merchant', () => {
    const { state, g } = start(2, { hand: ['vassal', 'merchant', 'silver', 'silver'], deck: ['throne_room', 'estate', 'estate'] });
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    g.apply('p0', answerOption(0));
    g.apply('p0', answerCards([0]));
    expect(state.pending).toBeNull();
    expect(state.turn.merchants).toBe(2);
    g.apply('p0', { type: 'playAllTreasures' });
    // Vassal $2 + two Silvers $4 + Merchant bonus $2.
    expect(state.turn.coins).toBe(8);
  });

  it('asks a Moat holder once per Militia play', () => {
    const { state, g } = start(3, { hand: ['throne_room', 'militia', 'copper'], deck: [] });
    setZones(state, 1, { hand: ['moat', 'gold', 'gold', 'gold', 'gold'], deck: [], discard: [] });
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    g.apply('p0', answerCards([0]));
    // First Militia: p1 is asked about Moat, then p2 discards.
    expect(state.pending).toMatchObject({ kind: 'chooseOption', player: 1, options: ['Reveal', "Don't reveal"] });
    g.apply('p1', answerOption(0));
    expect(state.pending).toMatchObject({ kind: 'chooseCards', player: 2 });
    g.apply('p2', answerCards([0, 1]));
    // Second Militia: p1 is asked again; p2 already has 3 cards.
    expect(state.pending).toMatchObject({ kind: 'chooseOption', player: 1 });
    g.apply('p1', answerOption(0));
    expect(state.pending).toBeNull();
    expect(state.turn.coins).toBe(4);
    expect(state.players[1].hand).toEqual(['moat', 'gold', 'gold', 'gold', 'gold']);
    expect(state.players[2].hand).toHaveLength(3);
  });
});
