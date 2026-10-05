import { describe, it, expect } from 'vitest';
import { colorHex } from '../theme/playerColors';
import { playerColor } from './playerColor';

const lobby = {
  hostId: 'p0',
  players: [
    { id: 'p0', name: 'Ana', online: true, color: 'teal' as const },
    { id: 'p1', name: 'Bo', online: true, color: 'pink' as const },
  ],
  kingdom: [],
  inGame: true,
  turnTimer: null,
};

describe('playerColor', () => {
  it('looks a player\'s color up by id', () => {
    expect(playerColor(lobby, 'p1')).toBe(colorHex('pink'));
  });

  it('falls back to the first palette color for unknown players', () => {
    expect(playerColor(lobby, 'zz')).toBe(colorHex(undefined));
  });
});
