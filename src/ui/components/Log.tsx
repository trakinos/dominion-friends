import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../engine/types';
import { useLang } from '../../i18n/LangProvider';
import { formatLogEntry } from '../format';

interface Props {
  entries: LogEntry[];
  names: string[];
}

export function Log({ entries, names }: Props) {
  const { tr } = useLang();
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);
  return (
    <ol className="log" ref={ref} aria-label={tr.t('gameLog')}>
      {entries.map((entry, i) => (
        <li key={i}>{formatLogEntry(entry, names, tr)}</li>
      ))}
    </ol>
  );
}
