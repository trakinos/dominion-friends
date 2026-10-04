import { KINGDOM_IDS } from '../../cards/registry';
import type { CardId } from '../../engine/types';
import { useLang } from '../../i18n/LangProvider';
import { sortByCost } from '../moves';
import { Card } from './Card';

interface Props {
  selected: CardId[];
  onToggle(id: CardId): void;
  onRandomize(): void;
}

export function KingdomPicker({ selected, onToggle, onRandomize }: Props) {
  const { tr } = useLang();
  const full = selected.length >= 10;
  return (
    <div className="picker">
      <div className="picker__bar">
        <span>{tr.t('chosen', { n: selected.length })}</span>
        <button type="button" onClick={onRandomize}>
          {tr.t('randomize')}
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
