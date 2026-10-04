import { describe, it, expect } from 'vitest';
import { KINGDOM_IDS } from '../cards/registry';
import { botMove } from '../sim/bigMoney';
import { Game } from './game';
import { createRng, nextFloat, nextInt, shuffle } from './rng';
import type { RngState } from './rng';

const JUNK: unknown[] = [
  null, undefined, 0, -1, 1, 2, 99, 1.5, NaN, Infinity, '0', '', 'gold', 'nonexistent_card', '__proto__', 'constructor',
  'toString', 'hasOwnProperty', [], [0], [0, 0], [0, 1], [1, 0], [-1], [99], [1.5], ['0'], [null], {}, true, false,
];
const INTENT_TYPES: unknown[] = [
  'playAction', 'playTreasure', 'playAllTreasures', 'buy', 'endPhase', 'answerPrompt', 'bogus', '', null, 5,
];
const ANSWER_KINDS: unknown[] = ['cards', 'supply', 'option', 'order', 'bogus', null];
const PLAYERS = ['a', 'b', 'c', 'zz', '__proto__', ''];

const pick = <T>(r: RngState, a: readonly T[]): T => a[nextInt(r, a.length)];

function junkIntent(r: RngState): unknown {
  const answer =
    nextFloat(r) < 0.15
      ? pick(r, JUNK)
      : { kind: pick(r, ANSWER_KINDS), indices: pick(r, JUNK), card: pick(r, JUNK), index: pick(r, JUNK), order: pick(r, JUNK) };
  const intent: Record<string, unknown> = { type: pick(r, INTENT_TYPES), handIndex: pick(r, JUNK), card: pick(r, JUNK), answer };
  if (nextFloat(r) < 0.2) delete intent.handIndex;
  if (nextFloat(r) < 0.2) delete intent.answer;
  return nextFloat(r) < 0.05 ? pick(r, JUNK) : intent;
}

describe('intent fuzz', () => {
  it('never throws, and rejected intents never change the state', () => {
    let rejected = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const r = createRng(seed * 7919);
      const game = Game.create({
        players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
        kingdom: shuffle(createRng(seed), KINGDOM_IDS).slice(0, 10),
        seed,
      });
      for (let step = 0; step < 1500 && !game.state.result; step++) {
        if (nextFloat(r) < 0.5) {
          const before = JSON.stringify(game.state);
          const res = game.apply(pick(r, PLAYERS), junkIntent(r) as never);
          if (!res.ok) {
            rejected++;
            expect(JSON.stringify(game.state)).toBe(before);
          }
        } else {
          const m = botMove(game);
          const res = game.apply(m.playerId, m.intent);
          if (!res.ok) throw new Error(`bot move rejected (seed ${seed}): ${res.reason}`);
        }
      }
    }
    expect(rejected).toBeGreaterThan(1000);
  });
});
