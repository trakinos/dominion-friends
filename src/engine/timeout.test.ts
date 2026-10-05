import { describe, it, expect } from 'vitest';
import { KINGDOM_IDS } from '../cards/registry';
import { botMove } from '../sim/bigMoney';
import { Game } from './game';
import { createRng, nextInt, shuffle } from './rng';
import { answerAtRandom, finishTurn } from './timeout';
import { newState, setZones } from './testkit';

describe('answerAtRandom', () => {
  it('returns false when nothing is pending', () => {
    expect(answerAtRandom(new Game(newState()), createRng(1))).toBe(false);
  });

  it('answers an attack response for the attacked player', () => {
    const state = newState();
    setZones(state, 0, { hand: ['militia'] });
    setZones(state, 1, { hand: ['copper', 'copper', 'estate', 'estate', 'silver'] });
    const game = new Game(state);
    expect(game.apply('p0', { type: 'playAction', handIndex: 0 }).ok).toBe(true);
    expect(game.state.pending?.player).toBe(1);
    expect(answerAtRandom(game, createRng(1))).toBe(true);
    expect(game.state.pending).toBeNull();
    expect(game.state.players[1].hand).toHaveLength(3);
  });
});

describe('finishTurn', () => {
  it('ends a fresh turn without playing or buying', () => {
    const game = new Game(newState());
    const handBefore = [...game.state.players[0].hand];
    finishTurn(game, createRng(1));
    expect(game.state.turn.player).toBe(1);
    expect(game.state.players[0].discard).toEqual(expect.arrayContaining(handBefore));
    expect(game.state.log.some((e) => e.text === 'buys')).toBe(false);
  });

  it('always passes the turn or ends the game, even mid-prompt', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const game = Game.create({
        players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
        kingdom: shuffle(createRng(seed), KINGDOM_IDS).slice(0, 10),
        seed,
      });
      const rng = createRng(seed);
      const warmup = nextInt(rng, 400);
      for (let i = 0; i < warmup && !game.state.result; i++) {
        const m = botMove(game);
        game.apply(m.playerId, m.intent);
      }
      if (game.state.result) continue;
      const turn = game.state.turn;
      finishTurn(game, rng);
      expect(game.state.result !== null || game.state.turn !== turn, `seed ${seed}`).toBe(true);
      expect(game.state.pending).toBeNull();
    }
  });
});
