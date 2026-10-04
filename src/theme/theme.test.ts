import { describe, it, expect } from 'vitest';
import { BASIC_IDS, KINGDOM_IDS } from '../cards/registry';
import { THEME_NAMES, cardName, splitRuleText } from '.';

describe('feira theme', () => {
  it('names every card in both languages, with no duplicates', () => {
    const ids = [...BASIC_IDS, ...KINGDOM_IDS];
    for (const id of ids) {
      expect(THEME_NAMES[id]?.pt, id).toBeTruthy();
      expect(THEME_NAMES[id]?.en, id).toBeTruthy();
    }
    for (const lang of ['pt', 'en'] as const) {
      expect(new Set(ids.map((id) => THEME_NAMES[id][lang])).size).toBe(ids.length);
    }
  });

  it('uses English names as the stable name', () => {
    expect(cardName('smithy')).toBe('Crate');
    expect(cardName('copper')).toBe('Cent');
  });

  it('falls back to the id for unknown cards', () => {
    expect(cardName('mystery')).toBe('mystery');
  });
});

describe('splitRuleText', () => {
  it('turns leading bonuses into chips in both languages', () => {
    expect(splitRuleText('+1 Card, +1 Action, +1 Buy, +$1.')).toEqual({
      chips: [
        { kind: 'card', n: 1 },
        { kind: 'action', n: 1 },
        { kind: 'buy', n: 1 },
        { kind: 'coin', n: 1 },
      ],
      rest: '',
    });
    expect(splitRuleText('+2 Cartas. Cada outro jogador ganha um Fiado.')).toEqual({
      chips: [{ kind: 'card', n: 2 }],
      rest: 'Cada outro jogador ganha um Fiado.',
    });
    expect(splitRuleText('+1 Carta, +2 Ações.').chips).toEqual([
      { kind: 'card', n: 1 },
      { kind: 'action', n: 2 },
    ]);
  });

  it('leaves texts without leading bonuses alone', () => {
    expect(splitRuleText('Trash up to 4 cards from your hand.')).toEqual({ chips: [], rest: 'Trash up to 4 cards from your hand.' });
    expect(splitRuleText('Gain a card costing up to $4.').chips).toEqual([]);
  });
});
