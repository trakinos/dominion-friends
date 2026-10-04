import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { answerCards, newState, setZones } from './testkit';
import type { CardId } from './types';

const ESTATES: CardId[] = ['estate', 'estate', 'estate', 'estate', 'estate'];

function gameWithHand(hand: CardId[], deck: CardId[] = ESTATES): Game {
  const state = newState();
  setZones(state, 0, { hand, deck, discard: [] });
  return new Game(state);
}

describe('turn flow', () => {
  it('plays treasures and buys a card', () => {
    const g = gameWithHand(['copper', 'copper', 'copper', 'estate', 'estate']);
    expect(g.apply('p0', { type: 'playAllTreasures' })).toEqual({ ok: true });
    expect(g.state.turn).toMatchObject({ phase: 'buy', coins: 3 });
    expect(g.state.players[0].inPlay).toEqual(['copper', 'copper', 'copper']);
    expect(g.apply('p0', { type: 'buy', card: 'silver' })).toEqual({ ok: true });
    expect(g.state.players[0].discard).toEqual(['silver']);
    expect(g.state.supply.silver).toBe(39);
    expect(g.state.turn).toMatchObject({ coins: 0, buys: 0 });
  });

  it('rejects a buy you cannot afford and leaves state unchanged', () => {
    const g = gameWithHand(['copper', 'copper', 'copper', 'estate', 'estate']);
    g.apply('p0', { type: 'playAllTreasures' });
    const before = structuredClone(g.state);
    expect(g.apply('p0', { type: 'buy', card: 'gold' })).toEqual({ ok: false, reason: 'Not enough coins' });
    expect(g.state).toEqual(before);
  });

  it('rejects buys from missing or empty piles and with no Buys left', () => {
    const g = gameWithHand(['copper', 'copper', 'copper', 'copper', 'copper']);
    g.apply('p0', { type: 'playAllTreasures' });
    expect(g.apply('p0', { type: 'buy', card: 'witch' })).toEqual({ ok: false, reason: 'No such pile' });
    g.state.supply.village = 0;
    expect(g.apply('p0', { type: 'buy', card: 'village' })).toEqual({ ok: false, reason: 'That pile is empty' });
    g.apply('p0', { type: 'buy', card: 'copper' });
    expect(g.apply('p0', { type: 'buy', card: 'copper' })).toEqual({ ok: false, reason: 'No Buys left' });
  });

  it('does not allow Treasures after buying', () => {
    const g = gameWithHand(['copper', 'copper', 'copper', 'copper', 'copper']);
    g.apply('p0', { type: 'playTreasure', handIndex: 0 });
    g.apply('p0', { type: 'buy', card: 'copper' });
    expect(g.apply('p0', { type: 'playTreasure', handIndex: 0 })).toEqual({
      ok: false, reason: 'You cannot play Treasures after buying',
    });
  });

  it('rejects moves out of turn and from unknown players', () => {
    const g = gameWithHand(ESTATES);
    expect(g.apply('p1', { type: 'endPhase' })).toEqual({ ok: false, reason: 'It is not your turn' });
    expect(g.apply('zz', { type: 'endPhase' })).toEqual({ ok: false, reason: 'Unknown player' });
    expect(g.apply('p0', { type: 'answerPrompt', answer: { kind: 'option', index: 0 } })).toEqual({
      ok: false, reason: 'Nothing to answer',
    });
  });

  it('enforces Action rules', () => {
    const g = gameWithHand(['smithy', 'smithy', 'copper', 'estate', 'estate'], Array(10).fill('estate'));
    expect(g.apply('p0', { type: 'playAction', handIndex: 2 })).toEqual({ ok: false, reason: 'That is not an Action card' });
    expect(g.apply('p0', { type: 'playAction', handIndex: 9 })).toEqual({ ok: false, reason: 'No such card in hand' });
    expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({ ok: true });
    expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({ ok: false, reason: 'No Actions left' });
    g.apply('p0', { type: 'endPhase' });
    expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({
      ok: false, reason: 'You can only play Actions in your Action phase',
    });
  });

  it('cleans up and passes the turn', () => {
    const g = gameWithHand(['copper', 'copper', 'copper', 'copper', 'copper']);
    g.apply('p0', { type: 'endPhase' });
    g.apply('p0', { type: 'endPhase' });
    const p0 = g.state.players[0];
    expect(p0.hand).toEqual(ESTATES);
    expect(p0.discard).toEqual(['copper', 'copper', 'copper', 'copper', 'copper']);
    expect(p0.turnsTaken).toBe(1);
    expect(g.state.turn).toMatchObject({ player: 1, phase: 'action', actions: 1, buys: 1, coins: 0 });
  });

  it('ends the game at the end of the turn when Provinces run out', () => {
    const g = gameWithHand(ESTATES);
    g.state.supply.province = 0;
    g.apply('p0', { type: 'endPhase' });
    expect(g.state.result).toBeNull();
    g.apply('p0', { type: 'endPhase' });
    expect(g.state.result).not.toBeNull();
    expect(g.state.result!.scores).toHaveLength(2);
    expect(g.apply('p1', { type: 'endPhase' })).toEqual({ ok: false, reason: 'The game is over' });
  });

  it('rejects prototype keys as pile names', () => {
    const g = gameWithHand(['copper', 'copper', 'copper', 'copper', 'copper']);
    g.apply('p0', { type: 'playAllTreasures' });
    for (const card of ['constructor', '__proto__', 'toString']) {
      expect(g.apply('p0', { type: 'buy', card: card as CardId })).toEqual({ ok: false, reason: 'No such pile' });
    }
  });

  it('rejects answers when no effect is waiting', () => {
    const g = gameWithHand(['chapel', 'copper', 'copper', 'estate', 'estate']);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    const rebuilt = new Game(g.state);
    expect(rebuilt.apply('p0', answerCards([0]))).toEqual({ ok: false, reason: 'This choice can no longer be resumed' });
  });
});

describe('simple action cards', () => {
  it('Village then Smithy', () => {
    const g = gameWithHand(['village', 'smithy', 'copper', 'copper', 'copper'], Array(10).fill('estate'));
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.turn.actions).toBe(2);
    expect(g.state.players[0].hand).toHaveLength(5);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.turn.actions).toBe(1);
    expect(g.state.players[0].hand).toHaveLength(7);
    expect(g.state.players[0].inPlay).toEqual(['village', 'smithy']);
    expect(g.state.log.map((l) => l.text)).toEqual(['plays', 'plays']);
  });

  it('Festival and Market', () => {
    const g = gameWithHand(['festival', 'market', 'estate', 'estate', 'estate'], ['copper']);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.turn).toMatchObject({ actions: 2, buys: 3, coins: 3 });
    expect(g.state.players[0].hand).toContain('copper');
  });

  it('Laboratory', () => {
    const g = gameWithHand(['laboratory', 'estate', 'estate', 'estate', 'estate'], ['gold', 'gold']);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.turn.actions).toBe(1);
    expect(g.state.players[0].hand).toEqual(['estate', 'estate', 'estate', 'estate', 'gold', 'gold']);
  });

  it('Chapel prompts the player and trashes the chosen cards', () => {
    const g = gameWithHand(['chapel', 'copper', 'copper', 'estate', 'estate']);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.pending).toMatchObject({
      kind: 'chooseCards', player: 0, min: 0, max: 4, cards: ['copper', 'copper', 'estate', 'estate'],
    });
    expect(g.apply('p0', { type: 'endPhase' })).toEqual({ ok: false, reason: 'Waiting for a choice to be made' });
    expect(g.apply('p1', answerCards([2, 3]))).toEqual({ ok: false, reason: 'It is not your choice to make' });
    expect(g.apply('p0', answerCards([0, 0]))).toEqual({ ok: false, reason: 'Duplicate selection' });
    expect(g.apply('p0', answerCards([2, 3]))).toEqual({ ok: true });
    expect(g.state.trash).toEqual(['estate', 'estate']);
    expect(g.state.players[0].hand).toEqual(['copper', 'copper']);
    expect(g.state.pending).toBeNull();
  });

  it('Chapel with an empty hand does not prompt', () => {
    const g = gameWithHand(['chapel']);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.pending).toBeNull();
  });
});
