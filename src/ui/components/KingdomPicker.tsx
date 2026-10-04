import { KINGDOM_IDS } from '../../cards/registry';
import type { CardId } from '../../engine/types';
import { sortByCost } from '../moves';
import { Card } from './Card';

interface Props {
  selected: CardId[];
  onToggle(id: CardId): void;
  onRandomize(): void;
}

export function KingdomPicker({ selected, onToggle, onRandomize }: Props) {
  const full = selected.length >= 10;
  return (
    <div className="picker">
      <div className="picker__bar">
        <span>{selected.length}/10 chosen</span>
        <button type="button" onClick={onRandomize}>
          Randomize
        </button>
      </div>
      <div className="card-grid">
        {sortByCost(KINGDOM_IDS).map((id) => {
          const isSelected = selected.includes(id);
          return (
            <Card
              key={id}
              id={id}
              selected={isSelected}
              dimmed={!isSelected && full}
              onClick={isSelected || !full ? () => onToggle(id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
