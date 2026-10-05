import { describe, it, expect } from 'vitest';
import { KINGDOM_IDS } from '../cards/registry';
import { botMove } from '../sim/bigMoney';
import { Game } from './game';
import { validateAnswer } from './prompts';
import { randomAnswer } from './randomAnswer';
import { createRng, shuffle } from './rng';
import type { Prompt } from './types';

const base = { id: 'x', player: 0, message: 'm' };

describe('randomAnswer', () => {
  it('answers each prompt kind legally', () => {
    const rng = createRng(3);
    const prompts: Prompt[] = [
      { ...base, kind: 'chooseCards', cards: ['copper', 'estate', 'silver'], selectable: [0, 2], min: 0, max: 2 },
      { ...base, kind: 'chooseCards', cards: ['copper', 'estate'], selectable: [0, 1], min: 2, max: 2 },
      { ...base, kind: 'chooseSupply', piles: ['silver', 'village'], optional: true },
      { ...base, kind: 'chooseSupply', piles: ['silver'], optional: false },
      { ...base, kind: 'chooseOption', options: ['a', 'b', 'c'], optionIds: ['a', 'b', 'c'] },
      { ...base, kind: 'orderCards', cards: ['copper', 'gold', 'estate'] },
    ] as Prompt[];
    for (let i = 0; i < 200; i++) {
      for (const p of prompts) expect(validateAnswer(p, randomAnswer(p, rng))).toBeNull();
    }
  });

  it('keeps whole seeded games legal when every prompt is answered at random', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const game = Game.create({
        players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
        kingdom: shuffle(createRng(seed), KINGDOM_IDS).slice(0, 10),
        seed,
      });
      const rng = createRng(seed * 31);
      for (let step = 0; step < 4000 && !game.state.result; step++) {
        const p = game.state.pending;
        if (p) {
          const answer = randomAnswer(p, rng);
          expect(validateAnswer(p, answer), `seed ${seed} prompt ${p.id}`).toBeNull();
          expect(game.apply(game.state.players[p.player].id, { type: 'answerPrompt', answer }).ok).toBe(true);
        } else {
          const m = botMove(game);
          expect(game.apply(m.playerId, m.intent).ok).toBe(true);
        }
      }
    }
  });
});

describe('randomAnswer edge cases', () => {
  it('clamps chooseCards when min exceeds the selectable cards, without throwing', () => {
    const rng = createRng(9);
    const p = { ...base, kind: 'chooseCards', cards: ['copper', 'estate', 'silver'], selectable: [1], min: 3, max: 3 } as Prompt;
    for (let i = 0; i < 50; i++) {
      const a = randomAnswer(p, rng);
      expect(a).toEqual({ kind: 'cards', indices: [1] });
    }
  });

  it('answers chooseCards with nothing selectable as an empty pick', () => {
    const p = { ...base, kind: 'chooseCards', cards: ['copper'], selectable: [], min: 1, max: 1 } as Prompt;
    expect(randomAnswer(p, createRng(1))).toEqual({ kind: 'cards', indices: [] });
  });

  it('answers a non-optional chooseSupply with no piles as null, without throwing', () => {
    const p = { ...base, kind: 'chooseSupply', piles: [], optional: false } as Prompt;
    expect(randomAnswer(p, createRng(1))).toEqual({ kind: 'supply', card: null });
  });

  it('only picks selectable indices and never repeats one', () => {
    const rng = createRng(5);
    const p = { ...base, kind: 'chooseCards', cards: ['a', 'b', 'c', 'd', 'e'], selectable: [0, 2, 4], min: 1, max: 5 } as Prompt;
    for (let i = 0; i < 200; i++) {
      const a = randomAnswer(p, rng) as { kind: 'cards'; indices: number[] };
      expect(a.indices.length).toBeGreaterThanOrEqual(1);
      expect(a.indices.length).toBeLessThanOrEqual(3);
      expect(new Set(a.indices).size).toBe(a.indices.length);
      expect(a.indices.every((x) => [0, 2, 4].includes(x))).toBe(true);
    }
  });
});
