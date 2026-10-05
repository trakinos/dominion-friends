export type PlayerColorId = 'blue' | 'red' | 'teal' | 'amber' | 'green' | 'purple' | 'pink' | 'slate';

/** Mid-tone colors: readable as solid fills and as a soft tint on light and dark backgrounds. White text on each is 4.5:1 or better. */
export const PLAYER_COLORS: readonly { id: PlayerColorId; hex: string }[] = [
  { id: 'blue', hex: '#2c4ba8' },
  { id: 'red', hex: '#b8321f' },
  { id: 'teal', hex: '#17716f' },
  { id: 'amber', hex: '#a66509' },
  { id: 'green', hex: '#2f7a35' },
  { id: 'purple', hex: '#6b3f9f' },
  { id: 'pink', hex: '#b83c78' },
  { id: 'slate', hex: '#4a5568' },
];

export function isPlayerColor(x: unknown): x is PlayerColorId {
  return typeof x === 'string' && PLAYER_COLORS.some((c) => c.id === x);
}

export function colorHex(id: PlayerColorId | undefined): string {
  return PLAYER_COLORS.find((c) => c.id === id)?.hex ?? PLAYER_COLORS[0].hex;
}
