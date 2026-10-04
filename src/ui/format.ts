import { getCard } from '../cards/registry';
import type { CardId, CardType, LogEntry } from '../engine/types';
import type { Translator } from '../i18n';

export function formatLogEntry(entry: LogEntry, names: string[], tr: Translator): string {
  return tr.logLine(entry, names);
}

export interface LogParts {
  who: string | null;
  text: string;
  /** Consecutive copies of a card are merged: "Cent ×3". */
  cards: { id: CardId; count: number }[];
}

export function logParts(entry: LogEntry, names: string[], tr: Translator): LogParts {
  const cards: LogParts['cards'] = [];
  for (const id of entry.cards ?? []) {
    const last = cards[cards.length - 1];
    if (last?.id === id) last.count++;
    else cards.push({ id, count: 1 });
  }
  return { who: entry.player === null ? null : (names[entry.player] ?? '—'), text: tr.logText(entry.text), cards };
}

/** The type that colors a card's frame: attack, then reaction, then the first listed type. */
export function primaryType(id: CardId): CardType {
  const types = getCard(id).types;
  return types.includes('attack') ? 'attack' : types.includes('reaction') ? 'reaction' : types[0];
}
