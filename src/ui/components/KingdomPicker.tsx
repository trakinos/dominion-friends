import { DEFAULT_KINGDOM, getCard, KINGDOM_IDS } from '../../cards/registry';
import type { CardId } from '../../engine/types';
import { useLang } from '../../i18n/LangProvider';
import { sortByCost } from '../moves';
import { Icon } from './Icon';
import { Legend } from './Legend';
import { Pile } from './Pile';

interface Props {
  selected: CardId[];
  onToggle(id: CardId): void;
  onRandomize(): void;
  onReset(): void;
}

export function KingdomPicker({ selected, onToggle, onRandomize, onReset }: Props) {
  const { tr } = useLang();
  const full = selected.length >= 10;
  const isDefault = selected.length === DEFAULT_KINGDOM.length && DEFAULT_KINGDOM.every((id) => selected.includes(id));
  const costs = [...new Set(KINGDOM_IDS.map((id) => getCard(id).cost))].sort((a, b) => a - b);
  return (
    <div className="picker">
      <div className="picker__bar">
        <h2>{tr.t('kingdom')}</h2>
        <span className="picker__count">{tr.t('chosen', { n: selected.length })}</span>
        <button type="button" onClick={onReset} disabled={isDefault} title={tr.t('defaultKingdomHint')}>
          <Icon name="refresh" />
          {tr.t('defaultKingdom')}
        </button>
        <button type="button" onClick={onRandomize}>
          <Icon name="shuffle" />
          {tr.t('randomize')}
        </button>
      </div>
      <Legend />
      {costs.map((cost) => (
        <div className="costrow" key={cost}>
          <div className="costrow__label">
            <span className="coin coin--lg">{cost}</span>
          </div>
          <div className="pile-grid">
            {sortByCost(KINGDOM_IDS.filter((id) => getCard(id).cost === cost)).map((id) => {
              const isSelected = selected.includes(id);
              return (
                <Pile
                  key={id}
                  id={id}
                  showTypes
                  selected={isSelected}
                  off={!isSelected && !full}
                  dimmed={!isSelected && full}
                  onClick={isSelected || !full ? () => onToggle(id) : undefined}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
