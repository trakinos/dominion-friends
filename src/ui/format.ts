import type { LogEntry } from '../engine/types';
import type { Translator } from '../i18n';

export function formatLogEntry(entry: LogEntry, names: string[], tr: Translator): string {
  return tr.logLine(entry, names);
}
