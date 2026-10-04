import type { Prompt } from './types';

/** Returns null if `answer` is a legal answer to `prompt`, otherwise a reason. */
export function validateAnswer(prompt: Prompt, answer: unknown): string | null {
  if (!answer || typeof answer !== 'object') return 'Invalid answer';
  const a = answer as Record<string, unknown>;
  switch (prompt.kind) {
    case 'chooseCards': {
      if (a.kind !== 'cards') return 'Expected a card selection';
      const indices = a.indices;
      if (!Array.isArray(indices) || !indices.every((i) => Number.isInteger(i))) return 'Invalid selection';
      if (new Set(indices).size !== indices.length) return 'Duplicate selection';
      if (indices.length < prompt.min || indices.length > prompt.max) {
        return `Choose between ${prompt.min} and ${prompt.max} cards`;
      }
      if (!indices.every((i) => prompt.selectable.includes(i))) return 'That card cannot be chosen';
      return null;
    }
    case 'chooseSupply': {
      if (a.kind !== 'supply') return 'Expected a supply pile';
      if (a.card === null) return prompt.optional ? null : 'You must choose a pile';
      return typeof a.card === 'string' && prompt.piles.includes(a.card) ? null : 'That pile cannot be chosen';
    }
    case 'chooseOption': {
      if (a.kind !== 'option') return 'Expected an option';
      const i = a.index;
      return Number.isInteger(i) && (i as number) >= 0 && (i as number) < prompt.options.length ? null : 'Invalid option';
    }
    case 'orderCards': {
      if (a.kind !== 'order') return 'Expected an order';
      const order = a.order;
      if (!Array.isArray(order) || order.length !== prompt.cards.length) return 'Order must include every card';
      const sorted = [...order].sort((x, y) => x - y);
      return sorted.every((v, i) => v === i) ? null : 'Order must include every card once';
    }
  }
}
