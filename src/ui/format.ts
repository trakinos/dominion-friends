import type { LogEntry } from '../engine/types';
import { cardName } from '../theme';

export function formatLogEntry(entry: LogEntry, names: string[]): string {
  const who = entry.player === null ? '' : `${names[entry.player] ?? 'Someone'} `;
  const cards = entry.cards && entry.cards.length > 0 ? ` ${entry.cards.map(cardName).join(', ')}` : '';
  return `${who}${entry.text}${cards}`;
}
