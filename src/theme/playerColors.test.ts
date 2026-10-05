import { describe, it, expect } from 'vitest';
import { PLAYER_COLORS, colorHex, isPlayerColor } from './playerColors';

describe('player colors', () => {
  it('has 8 distinct colors', () => {
    expect(PLAYER_COLORS.map((c) => c.id)).toEqual(['blue', 'red', 'teal', 'amber', 'green', 'purple', 'pink', 'slate']);
    expect(new Set(PLAYER_COLORS.map((c) => c.hex)).size).toBe(8);
  });

  it('recognises palette ids only', () => {
    expect(isPlayerColor('teal')).toBe(true);
    for (const x of ['Teal', 'orange', '', null, 3, '__proto__']) expect(isPlayerColor(x)).toBe(false);
  });

  it('maps ids to hex, defaulting to blue', () => {
    expect(colorHex('red')).toBe(PLAYER_COLORS[1].hex);
    expect(colorHex(undefined)).toBe(PLAYER_COLORS[0].hex);
  });
});
