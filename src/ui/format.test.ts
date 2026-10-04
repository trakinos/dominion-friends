import { describe, it, expect } from 'vitest';
import { formatLogEntry, logParts, primaryType } from './format';
import { translator } from '../i18n';

const en = translator('en');
const pt = translator('pt');

describe('formatLogEntry', () => {
  const names = ['Ana', 'Bo'];

  it('names the player and the cards', () => {
    expect(formatLogEntry({ player: 0, text: 'plays', cards: ['village', 'smithy'] }, names, en)).toBe('Ana plays Work Party, Crate');
  });

  it('handles entries without cards or without a player', () => {
    expect(formatLogEntry({ player: 1, text: 'puts a card onto their deck' }, names, en)).toBe('Bo puts a card onto their deck');
    expect(formatLogEntry({ player: null, text: 'Game over' }, names, en)).toBe('Game over');
  });

  it('translates with the pt translator', () => {
    expect(formatLogEntry({ player: 0, text: 'plays', cards: ['village'] }, names, pt)).toBe(`Ana joga ${pt.card('village')}`);
  });
});

describe('logParts', () => {
  it('merges consecutive copies of a card', () => {
    expect(logParts({ player: 0, text: 'plays', cards: ['copper', 'copper', 'silver', 'copper'] }, ['Ana'], pt)).toEqual({
      who: 'Ana',
      text: 'joga',
      cards: [
        { id: 'copper', count: 2 },
        { id: 'silver', count: 1 },
        { id: 'copper', count: 1 },
      ],
    });
  });

  it('has no player for game-wide entries', () => {
    expect(logParts({ player: null, text: 'Game over' }, [], en)).toEqual({ who: null, text: 'Game over', cards: [] });
  });
});

describe('primaryType', () => {
  it('prefers attack, then reaction', () => {
    expect(primaryType('witch')).toBe('attack');
    expect(primaryType('moat')).toBe('reaction');
    expect(primaryType('gold')).toBe('treasure');
  });
});
