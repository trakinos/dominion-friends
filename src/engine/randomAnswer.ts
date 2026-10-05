import { nextInt, shuffle, type RngState } from './rng';
import type { Prompt, PromptAnswer } from './types';

/** A uniformly random legal answer. Used when a player's clock runs out. */
export function randomAnswer(prompt: Prompt, rng: RngState): PromptAnswer {
  switch (prompt.kind) {
    case 'chooseCards': {
      const max = Math.min(prompt.max, prompt.selectable.length);
      const min = Math.min(prompt.min, max);
      const count = min + nextInt(rng, max - min + 1);
      return { kind: 'cards', indices: shuffle(rng, prompt.selectable).slice(0, count) };
    }
    case 'chooseSupply': {
      const skip = prompt.piles.length === 0 || (prompt.optional && nextInt(rng, prompt.piles.length + 1) === 0);
      return { kind: 'supply', card: skip ? null : prompt.piles[nextInt(rng, prompt.piles.length)] };
    }
    case 'chooseOption':
      return { kind: 'option', index: nextInt(rng, prompt.options.length) };
    case 'orderCards':
      return { kind: 'order', order: shuffle(rng, prompt.cards.map((_, i) => i)) };
  }
}
