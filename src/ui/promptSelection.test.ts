import { describe, it, expect } from 'vitest';
import type { Prompt } from '../engine/types';
import { cardsAnswer, selectionHint, toggle } from './promptSelection';

const choose = (selectable: number[], min: number, max: number): Prompt => ({
  kind: 'chooseCards', id: 't', player: 0, message: '', cards: ['copper', 'estate', 'silver'], selectable, min, max,
});
const order: Prompt = { kind: 'orderCards', id: 't', player: 0, message: '', cards: ['gold', 'silver'] };

describe('promptSelection', () => {
  it('toggles only selectable cards, up to max', () => {
    const p = choose([0, 2], 1, 2);
    expect(toggle(p, [], 1)).toEqual([]);
    expect(toggle(p, [], 0)).toEqual([0]);
    expect(toggle(p, [0], 2)).toEqual([0, 2]);
    expect(toggle(p, [0, 2], 0)).toEqual([2]);
    expect(toggle(choose([0, 1, 2], 0, 2), [0, 1], 2)).toEqual([0, 1]);
  });

  it('replaces the pick when only one card may be chosen', () => {
    expect(toggle(choose([0, 1, 2], 1, 1), [0], 2)).toEqual([2]);
  });

  it('builds a card answer only within min and max', () => {
    const p = choose([0, 1, 2], 1, 2);
    expect(cardsAnswer(p, [])).toBeNull();
    expect(cardsAnswer(p, [2, 0])).toEqual({ kind: 'cards', indices: [0, 2] });
    expect(cardsAnswer(choose([0, 1, 2], 0, 4), [])).toEqual({ kind: 'cards', indices: [] });
  });

  it('builds an order answer once every card is placed', () => {
    expect(toggle(order, [], 1)).toEqual([1]);
    expect(toggle(order, [1], 1)).toEqual([]);
    expect(toggle(order, [], 5)).toEqual([]);
    expect(cardsAnswer(order, [1])).toBeNull();
    expect(cardsAnswer(order, [1, 0])).toEqual({ kind: 'order', order: [1, 0] });
  });

  it('describes what to pick', () => {
    expect(selectionHint(choose([0], 2, 2))).toBe('Choose 2 cards.');
    expect(selectionHint(choose([0], 0, 4))).toBe('Choose up to 4 cards.');
    expect(selectionHint(choose([0], 0, 1))).toBe('Choose up to 1 card.');
    expect(selectionHint(choose([0], 1, 2))).toBe('Choose 1 to 2 cards.');
    expect(selectionHint(order)).toBe('Click the cards in order, starting with the one to put on top.');
  });
});
