import { describe, it, expect } from 'vitest';
import { BASIC_IDS, KINGDOM_IDS } from '../cards/registry';
import { PLACEHOLDER_NAMES, cardName } from '.';

describe('placeholder theme', () => {
  it('names every card, with no duplicates', () => {
    const ids = [...BASIC_IDS, ...KINGDOM_IDS];
    for (const id of ids) expect(PLACEHOLDER_NAMES[id], id).toBeTruthy();
    expect(new Set(ids.map(cardName)).size).toBe(ids.length);
  });

  it('uses the spec placeholder names', () => {
    expect(cardName('smithy')).toBe('Draw Three');
    expect(cardName('throne_room')).toBe('Echo');
    expect(cardName('copper')).toBe('Copper');
  });

  it('falls back to the id for unknown cards', () => {
    expect(cardName('mystery')).toBe('mystery');
  });
});
