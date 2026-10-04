import { getCard } from '../../cards/registry';
import type { CardId } from '../../engine/types';
import { useLang } from '../../i18n/LangProvider';

interface Props {
  id: CardId;
  size?: 'normal' | 'small';
  highlight?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  badge?: string | number;
  onClick?: () => void;
}

export function Card({ id, size = 'normal', highlight, selected, dimmed, badge, onClick }: Props) {
  const { tr } = useLang();
  const def = getCard(id);
  const primary = def.types.includes('attack') ? 'attack' : def.types.includes('reaction') ? 'reaction' : def.types[0];
  const className = [
    'card',
    `card--${primary}`,
    `card--${size}`,
    highlight && 'is-highlight',
    selected && 'is-selected',
    dimmed && 'is-dimmed',
    onClick && 'is-clickable',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={className} onClick={onClick} disabled={!onClick} title={`${tr.card(id)}: ${tr.cardText(id)}`}>
      <span className="card__cost">{'$' + def.cost}</span>
      <span className="card__name">{tr.card(id)}</span>
      {size === 'normal' && <span className="card__text">{tr.cardText(id)}</span>}
      <span className="card__types">{def.types.map((ty) => tr.cardType(ty)).join(' · ')}</span>
      {badge !== undefined && <span className="card__badge">{badge}</span>}
    </button>
  );
}
