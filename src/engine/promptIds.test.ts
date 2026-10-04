import { describe, it, expect } from 'vitest';
import { KINGDOM_IDS } from '../cards/registry';
import { createRng, shuffle } from './rng';
import { Game } from './game';
import { botMove } from '../sim/bigMoney';
import { viewFor } from './view';

describe('prompt ids', () => {
  it('every prompt in 100 bot games has an id, and option prompts have matching optionIds', () => {
    let prompts = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const n = 2 + (seed % 3);
      const game = Game.create({
        players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `B${i}` })),
        kingdom: shuffle(createRng(seed), KINGDOM_IDS).slice(0, 10),
        seed,
      });
      for (let step = 0; step < 20000 && !game.state.result; step++) {
        const p = game.state.pending;
        if (p) {
          prompts++;
          expect(typeof p.id, JSON.stringify(p)).toBe('string');
          expect(p.id.length).toBeGreaterThan(0);
          if (p.kind === 'chooseOption') expect(p.optionIds).toHaveLength(p.options.length);
          const other = game.state.players[(p.player + 1) % n].id;
          const waiting = viewFor(game.state, other).waitingOn;
          if (other !== game.state.players[p.player].id) expect(waiting).toMatchObject({ id: p.id });
        }
        const { playerId, intent } = botMove(game);
        game.apply(playerId, intent);
      }
    }
    expect(prompts).toBeGreaterThan(500);
  });
});
