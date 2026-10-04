import type { CardId } from '../../engine/types';
import type { PlayerView } from '../../engine/view';
import { supplyGroups } from '../moves';
import { Pile } from './Pile';

interface Props {
  view: PlayerView;
  buyable: Set<CardId>;
  /** Buy phase: piles you cannot afford fade out. */
  buying: boolean;
  onBuy(card: CardId): void;
}

export function Supply({ view, buyable, buying, onBuy }: Props) {
  const groups = supplyGroups(view);
  const pile = (id: CardId, showTypes: boolean) => (
    <Pile
      key={id}
      id={id}
      count={view.supply[id]}
      showTypes={showTypes}
      highlight={buyable.has(id)}
      dimmed={buying && !buyable.has(id) && view.supply[id] > 0}
      onClick={buyable.has(id) ? () => onBuy(id) : undefined}
    />
  );
  return (
    <div className="supply">
      <div className="supply__basics">
        {groups.treasure.map((id) => pile(id, false))}
        {groups.victory.map((id) => pile(id, false))}
      </div>
      <div className="supply__kingdom">{groups.kingdom.map((id) => pile(id, true))}</div>
    </div>
  );
}
