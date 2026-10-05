import type { CardId, CardType } from '../engine/types';
import { BASIC_CARDS, KINGDOM_CARDS } from './data';
import { EFFECTS } from './effects';
import type { CardDef } from './types';

const CARDS = new Map<CardId, CardDef>();
for (const data of [...BASIC_CARDS, ...KINGDOM_CARDS]) {
  CARDS.set(data.id, { ...data, play: EFFECTS[data.id] });
}

export const BASIC_IDS: CardId[] = BASIC_CARDS.map((c) => c.id);
export const KINGDOM_IDS: CardId[] = KINGDOM_CARDS.map((c) => c.id);
/** The rulebook's recommended "First Game" set (2nd edition). */
export const DEFAULT_KINGDOM: CardId[] = [
  'cellar', 'market', 'merchant', 'militia', 'mine', 'moat', 'remodel', 'smithy', 'village', 'workshop',
];

export function getCard(id: CardId): CardDef {
  const card = CARDS.get(id);
  if (!card) throw new Error(`Unknown card: ${id}`);
  return card;
}

export function isType(id: CardId, type: CardType): boolean {
  return getCard(id).types.includes(type);
}

export function cardVp(id: CardId, owned: CardId[]): number {
  const vp = getCard(id).vp;
  return typeof vp === 'function' ? vp(owned) : (vp ?? 0);
}
