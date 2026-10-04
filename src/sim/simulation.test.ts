import { describe, it, expect } from 'vitest';
import { KINGDOM_IDS, isType } from '../cards/registry';
import { Game } from '../engine/game';
import { createRng, shuffle } from '../engine/rng';
import type { GameState } from '../engine/types';
import { ownedCards } from '../engine/zones';
import { botMove } from './bigMoney';

function totalCards(s: GameState): number {
  const owned = s.players.reduce((n, p) => n + ownedCards(p).length, 0);
  const supply = Object.values(s.supply).reduce((a, b) => a + b, 0);
  return owned + supply + s.trash.length;
}

const stats = { prompts: 0, played: new Set<string>() };

function runGame(seed: number): Game {
  const players = 2 + (seed % 3);
  const kingdom = shuffle(createRng(seed), KINGDOM_IDS).slice(0, 10);
  const game = Game.create({
    players: Array.from({ length: players }, (_, i) => ({ id: `p${i}`, name: `Bot ${i}` })),
    kingdom,
    seed,
  });
  const expected = totalCards(game.state);
  for (let step = 0; step < 20000 && !game.state.result; step++) {
    const { playerId, intent } = botMove(game);
    const playedCard =
      intent.type === 'playAction'
        ? game.state.players.find((p) => p.id === playerId)!.hand[intent.handIndex]
        : null;
    const res = game.apply(playerId, intent);
    if (res.ok && playedCard) stats.played.add(playedCard);
    if (res.ok && intent.type === 'answerPrompt') stats.prompts++;
    if (!res.ok) throw new Error(`seed ${seed}: illegal bot move ${JSON.stringify(intent)}: ${res.reason}`);
    if (!game.state.pending && totalCards(game.state) !== expected) {
      throw new Error(`seed ${seed}: card count changed at step ${step}`);
    }
  }
  return game;
}

describe('simulation', () => {
  it('200 Big Money games on random kingdoms all finish with cards conserved', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const game = runGame(seed);
      expect(game.state.result, `seed ${seed} did not finish`).not.toBeNull();
      expect(game.state.result!.winners.length).toBeGreaterThan(0);
    }
    expect(stats.prompts).toBeGreaterThan(1000);
    const actions = KINGDOM_IDS.filter((c) => isType(c, 'action'));
    expect(actions.length).toBe(25);
    const missing = actions.filter((c) => !stats.played.has(c));
    expect(missing.length, `kingdom cards never played: ${missing.join(', ')}`).toBeLessThanOrEqual(1);
  });
});
