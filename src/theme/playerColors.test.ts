import { describe, it, expect } from 'vitest';
import { PLAYER_COLORS, colorHex, isPlayerColor } from './playerColors';

/** WCAG 2 contrast ratio of white text on `hex`. */
function contrastWithWhite(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

describe('player colors', () => {
  it('has 8 distinct colors', () => {
    expect(PLAYER_COLORS.map((c) => c.id)).toEqual(['blue', 'red', 'teal', 'amber', 'green', 'purple', 'pink', 'slate']);
    expect(new Set(PLAYER_COLORS.map((c) => c.hex)).size).toBe(8);
  });

  it('keeps white text (the turn pill, avatars) at 4.5:1 or better on every color', () => {
    for (const c of PLAYER_COLORS) expect(contrastWithWhite(c.hex), c.id).toBeGreaterThanOrEqual(4.5);
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
