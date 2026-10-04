import { describe, it, expect } from 'vitest';
import { Game } from '../../engine/game';
import { answerCards, answerOption, newState, setZones } from '../../engine/testkit';
import type { CardId } from '../../engine/types';

const COPPERS: CardId[] = ['copper', 'copper', 'copper', 'copper', 'copper'];

/** 3-player game. Player 0 has `card` at hand index 0; opponents get the given hands and decks. */
function attack(card: CardId, opp: { hand: CardId[]; deck?: CardId[] }[]): Game {
  const state = newState({ players: 3 });
  setZones(state, 0, { hand: [card, 'estate', 'estate', 'estate', 'estate'], deck: Array(5).fill('estate'), discard: [] });
  opp.forEach((o, i) => setZones(state, i + 1, { hand: o.hand, deck: o.deck ?? [], discard: [] }));
  const g = new Game(state);
  expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({ ok: true });
  return g;
}

describe('Militia', () => {
  it('makes each other player discard down to 3', () => {
    const g = attack('militia', [{ hand: COPPERS }, { hand: ['copper', 'copper', 'copper'] }]);
    expect(g.state.turn.coins).toBe(2);
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', player: 1, min: 2, max: 2 });
    expect(g.apply('p0', answerCards([0, 1]))).toEqual({ ok: false, reason: 'It is not your choice to make' });
    g.apply('p1', answerCards([0, 1]));
    expect(g.state.players[1].hand).toHaveLength(3);
    expect(g.state.players[1].discard).toEqual(['copper', 'copper']);
    expect(g.state.pending).toBeNull();
  });

  it('is blocked by a revealed Moat', () => {
    const g = attack('militia', [{ hand: ['moat', ...COPPERS.slice(1)] }, { hand: COPPERS }]);
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', player: 1 });
    g.apply('p1', answerOption(0));
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', player: 2 });
    g.apply('p2', answerCards([0, 1]));
    expect(g.state.players[1].hand).toHaveLength(5);
    expect(g.state.players[2].hand).toHaveLength(3);
  });

  it('still hits a player who does not reveal Moat', () => {
    const g = attack('militia', [{ hand: ['moat', ...COPPERS.slice(1)] }, { hand: ['copper'] }]);
    g.apply('p1', answerOption(1));
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', player: 1, min: 2, max: 2 });
  });
});

describe('Witch', () => {
  it('draws 2 and gives each other player a Curse', () => {
    const g = attack('witch', [{ hand: COPPERS }, { hand: COPPERS }]);
    expect(g.state.players[0].hand).toHaveLength(6);
    expect(g.state.players[1].discard).toEqual(['curse']);
    expect(g.state.players[2].discard).toEqual(['curse']);
    expect(g.state.supply.curse).toBe(18);
  });

  it('stops giving Curses when the pile runs out', () => {
    const state = newState({ players: 3 });
    state.supply.curse = 1;
    setZones(state, 0, { hand: ['witch'], deck: ['estate', 'estate'], discard: [] });
    const g = new Game(state);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.players[1].discard).toContain('curse');
    expect(g.state.players[2].discard).not.toContain('curse');
  });
});

describe('Bandit', () => {
  it('gains a Gold and trashes non-Copper Treasures from the top of each deck', () => {
    const g = attack('bandit', [
      { hand: COPPERS, deck: ['gold', 'copper'] },
      { hand: COPPERS, deck: ['silver', 'gold'] },
    ]);
    expect(g.state.players[0].discard).toEqual(['gold']);
    expect(g.state.players[1].discard).toEqual(['copper']);
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', player: 2, cards: ['silver', 'gold'], selectable: [0, 1] });
    g.apply('p2', answerCards([0]));
    expect(g.state.trash).toEqual(['gold', 'silver']);
    expect(g.state.players[2].discard).toEqual(['gold']);
  });
});

describe('Bureaucrat', () => {
  it('topdecks a Silver and makes others topdeck a Victory card', () => {
    const g = attack('bureaucrat', [
      { hand: ['estate', 'duchy', 'copper', 'copper', 'copper'] },
      { hand: COPPERS },
    ]);
    expect(g.state.players[0].deck[0]).toBe('silver');
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', player: 1, selectable: [0, 1], min: 1, max: 1 });
    g.apply('p1', answerCards([1]));
    expect(g.state.players[1].deck[0]).toBe('duchy');
    expect(g.state.players[1].hand).toHaveLength(4);
    expect(g.state.log.some((l) => l.player === 2 && l.text === 'reveals a hand with no Victory cards')).toBe(true);
  });

  it('topdecks automatically when there is only one Victory card', () => {
    const g = attack('bureaucrat', [{ hand: ['estate', 'copper'] }, { hand: COPPERS }]);
    expect(g.state.players[1].deck[0]).toBe('estate');
    expect(g.state.pending).toBeNull();
  });
});
