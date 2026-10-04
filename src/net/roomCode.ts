/** No I, L, O, 0 or 1, so codes are easy to read aloud and type. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export function generateRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return code.length === CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c)) ? code : null;
}

export function peerIdFor(code: string): string {
  return `dmf-${code}`;
}

export function joinLink(base: string, code: string): string {
  return `${base}#join=${code}`;
}

export function codeFromHash(hash: string): string | null {
  const match = /^#join=(.+)$/.exec(hash);
  return match ? normalizeRoomCode(match[1]) : null;
}
