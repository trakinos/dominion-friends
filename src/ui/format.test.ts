import { describe, it, expect } from 'vitest';
import { formatLogEntry } from './format';

describe('formatLogEntry', () => {
  const names = ['Ana', 'Bo'];

  it('names the player and the cards', () => {
    expect(formatLogEntry({ player: 0, text: 'plays', cards: ['village', 'smithy'] }, names)).toBe('Ana plays Village, Draw Three');
  });

  it('handles entries without cards or without a player', () => {
    expect(formatLogEntry({ player: 1, text: 'puts a card onto their deck' }, names)).toBe('Bo puts a card onto their deck');
    expect(formatLogEntry({ player: null, text: 'Game over' }, names)).toBe('Game over');
  });
});
