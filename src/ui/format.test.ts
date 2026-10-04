import { describe, it, expect } from 'vitest';
import { formatLogEntry } from './format';
import { translator } from '../i18n';

const en = translator('en');
const pt = translator('pt');

describe('formatLogEntry', () => {
  const names = ['Ana', 'Bo'];

  it('names the player and the cards', () => {
    expect(formatLogEntry({ player: 0, text: 'plays', cards: ['village', 'smithy'] }, names, en)).toBe('Ana plays Village, Draw Three');
  });

  it('handles entries without cards or without a player', () => {
    expect(formatLogEntry({ player: 1, text: 'puts a card onto their deck' }, names, en)).toBe('Bo puts a card onto their deck');
    expect(formatLogEntry({ player: null, text: 'Game over' }, names, en)).toBe('Game over');
  });

  it('translates with the pt translator', () => {
    expect(formatLogEntry({ player: 0, text: 'plays', cards: ['village'] }, names, pt)).toBe(`Ana joga ${pt.card('village')}`);
  });
});
