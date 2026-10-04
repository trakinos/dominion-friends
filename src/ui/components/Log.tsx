import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../engine/types';
import { formatLogEntry } from '../format';

interface Props {
  entries: LogEntry[];
  names: string[];
}

export function Log({ entries, names }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);
  return (
    <ol className="log" ref={ref} aria-label="Game log">
      {entries.map((entry, i) => (
        <li key={i}>{formatLogEntry(entry, names)}</li>
      ))}
    </ol>
  );
}
