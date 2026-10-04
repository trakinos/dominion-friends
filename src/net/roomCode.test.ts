import { describe, it, expect } from 'vitest';
import { CODE_LENGTH, ROOM_CODE_ALPHABET, codeFromHash, generateRoomCode, joinLink, normalizeRoomCode, peerIdFor } from './roomCode';

describe('room codes', () => {
  it('generates codes from the unambiguous alphabet', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAA');
    expect(generateRoomCode(() => 0.9999)).toBe('9999');
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect([...code].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
    }
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[IL0O1]/);
  });

  it('normalizes typed codes', () => {
    expect(normalizeRoomCode(' abcd ')).toBe('ABCD');
    expect(normalizeRoomCode('ABC')).toBeNull();
    expect(normalizeRoomCode('ABCDE')).toBeNull();
    expect(normalizeRoomCode('AB0D')).toBeNull();
  });

  it('builds peer ids and share links', () => {
    expect(peerIdFor('ABCD')).toBe('dmf-ABCD');
    expect(joinLink('https://x.io/app/', 'ABCD')).toBe('https://x.io/app/#join=ABCD');
  });

  it('reads the code from the URL hash', () => {
    expect(codeFromHash('#join=abcd')).toBe('ABCD');
    expect(codeFromHash('')).toBeNull();
    expect(codeFromHash('#join=??')).toBeNull();
    expect(codeFromHash('#other=ABCD')).toBeNull();
  });
});
