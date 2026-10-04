import type { CardId } from '../../engine/types';
import type { PlayerView } from '../../engine/view';
import { supplyGroups } from '../moves';
import { Card } from './Card';

interface Props {
  view: PlayerView;
  buyable: Set<CardId>;
  onBuy(card: CardId): void;
}

export function Supply({ view, buyable, onBuy }: Props) {
  const groups = supplyGroups(view);
  const pile = (id: CardId, size: 'normal' | 'small') => (
    <Card
      key={id}
      id={id}
      size={size}
      badge={view.supply[id]}
      dimmed={view.supply[id] === 0}
      highlight={buyable.has(id)}
      onClick={buyable.has(id) ? () => onBuy(id) : undefined}
    />
  );
  return (
    <div className="supply">
      <div className="supply__basics">
        {groups.treasure.map((id) => pile(id, 'small'))}
        {groups.victory.map((id) => pile(id, 'small'))}
      </div>
      <div className="supply__kingdom">{groups.kingdom.map((id) => pile(id, 'normal'))}</div>
    </div>
  );
}
