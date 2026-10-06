import { useState } from 'react';
import { getCard } from '../../cards/registry';
import type { CardId } from '../../engine/types';
import { useLang } from '../../i18n/LangProvider';
import { primaryType } from '../format';
import { Card } from './Card';
import { Icon } from './Icon';

interface Props {
  id: CardId;
  /** Cards left; omitted in the lobby picker. */
  count?: number;
  highlight?: boolean;
  selected?: boolean;
  /** Not selected in the picker. */
  off?: boolean;
  dimmed?: boolean;
  /** Show the type line under the name. */
  showTypes?: boolean;
  onClick?: () => void;
}

/**
 * A compact Supply pile. Hovering (or long-pressing on touch) shows the full card,
 * so every tile has the same height no matter how long its rule text is.
 */
export function Pile({ id, count, highlight, selected, off, dimmed, showTypes, onClick }: Props) {
  const { tr } = useLang();
  const [peek, setPeek] = useState(false);
  const def = getCard(id);
  const name = tr.card(id);
  const text = tr.cardText(id);
  const empty = count === 0;
  const types = def.types.map((ty) => tr.cardType(ty)).join(' · ');
  const className = [
    'pile',
    `card--${primaryType(id)}`,
    highlight && 'is-highlight',
    selected && 'is-selected',
    off && 'is-off',
    dimmed && 'is-dimmed',
    empty && 'is-empty',
    onClick && 'is-clickable',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={`pile-wrap ${peek ? 'is-peek' : ''}`} onPointerLeave={() => setPeek(false)} data-motion={`pile-${id}`}>
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={!onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setPeek((p) => !p);
        }}
        onBlur={() => setPeek(false)}
        title={`${name}: ${text}`}
        aria-label={`${name}, $${def.cost}${count === undefined ? '' : `, ×${count}`}. ${types}. ${text}`}
        aria-pressed={selected === undefined ? undefined : selected}
      >
        {selected && (
          <span className="pile__check">
            <Icon name="check" />
          </span>
        )}
        <span className="pile__thumb" aria-hidden="true">
          {empty ? '0' : def.types.includes('treasure') ? text : name.charAt(0)}
        </span>
        <span className="pile__name" aria-hidden="true">
          {name}
          {showTypes && <span className="pile__sub">{types}</span>}
        </span>
        <span className="pile__end" aria-hidden="true">
          <span className="coin">{def.cost}</span>
          {count !== undefined && <span className="pile__count">{empty ? tr.t('pileEmpty') : `×${count}`}</span>}
        </span>
      </button>
      <div className="pile__preview" aria-hidden="true">
        <Card id={id} size="big" />
      </div>
    </div>
  );
}
