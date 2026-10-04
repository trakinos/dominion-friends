import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../engine/types';
import { useLang } from '../../i18n/LangProvider';
import { logParts, primaryType } from '../format';

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
      {entries.map((entry, i) => {
        const parts = logParts(entry, names, tr);
        return (
          <li key={i}>
            {parts.who && <span className="log__who">{parts.who}</span>}
            <span>{parts.text}</span>
            {parts.cards.map((c, j) => (
              <span key={j} className="log__card">
                <span className={`lchip lchip--${primaryType(c.id)}`}>{tr.card(c.id)}</span>
                {c.count > 1 && <span className="lx"> ×{c.count}</span>}
              </span>
            ))}
          </li>
        );
      })}
    </ol>
  );
}
