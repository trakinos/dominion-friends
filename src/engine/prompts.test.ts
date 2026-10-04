import { describe, it, expect } from 'vitest';
import { validateAnswer } from './prompts';
import type { Prompt } from './types';

const cards: Prompt = {
  kind: 'chooseCards', id: 't', player: 0, message: '', cards: ['copper', 'estate', 'silver'], selectable: [0, 2], min: 1, max: 2,
};
const supply: Prompt = { kind: 'chooseSupply', id: 't', player: 0, message: '', piles: ['silver', 'village'], optional: false };
const option: Prompt = { kind: 'chooseOption', id: 't', player: 0, message: '', options: ['Yes', 'No'], optionIds: ['yes', 'no'] };
const order: Prompt = { kind: 'orderCards', id: 't', player: 0, message: '', cards: ['gold', 'estate'] };

describe('validateAnswer', () => {
  it('validates card selections', () => {
    expect(validateAnswer(cards, { kind: 'cards', indices: [0, 2] })).toBeNull();
    expect(validateAnswer(cards, { kind: 'cards', indices: [1] })).toBe('That card cannot be chosen');
    expect(validateAnswer(cards, { kind: 'cards', indices: [] })).toBe('Choose between 1 and 2 cards');
    expect(validateAnswer(cards, { kind: 'cards', indices: [0, 0] })).toBe('Duplicate selection');
    expect(validateAnswer(cards, { kind: 'cards', indices: [0.5] })).toBe('Invalid selection');
    expect(validateAnswer(cards, { kind: 'option', index: 0 })).toBe('Expected a card selection');
  });

  it('validates supply choices', () => {
    expect(validateAnswer(supply, { kind: 'supply', card: 'village' })).toBeNull();
    expect(validateAnswer(supply, { kind: 'supply', card: 'gold' })).toBe('That pile cannot be chosen');
    expect(validateAnswer(supply, { kind: 'supply', card: null })).toBe('You must choose a pile');
    expect(validateAnswer({ ...supply, optional: true }, { kind: 'supply', card: null })).toBeNull();
  });

  it('validates options', () => {
    expect(validateAnswer(option, { kind: 'option', index: 1 })).toBeNull();
    expect(validateAnswer(option, { kind: 'option', index: 2 })).toBe('Invalid option');
  });

  it('validates orders', () => {
    expect(validateAnswer(order, { kind: 'order', order: [1, 0] })).toBeNull();
    expect(validateAnswer(order, { kind: 'order', order: [0] })).toBe('Order must include every card');
    expect(validateAnswer(order, { kind: 'order', order: [0, 0] })).toBe('Order must include every card once');
  });

  it('rejects malformed answers', () => {
    expect(validateAnswer(cards, null)).toBe('Invalid answer');
    expect(validateAnswer(cards, 'cards')).toBe('Invalid answer');
  });
});
