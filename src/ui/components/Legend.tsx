import type { CardType } from '../../engine/types';
import type { UiKey } from '../../i18n';
import { useLang } from '../../i18n/LangProvider';
import { Icon, type IconName } from './Icon';

const BONUSES: { icon: 'card' | 'action' | 'buy' | 'coin'; chip: string; label: UiKey }[] = [
  { icon: 'card', chip: '+1', label: 'legendCard' },
  { icon: 'action', chip: '+1', label: 'legendAction' },
  { icon: 'buy', chip: '+1', label: 'legendBuy' },
  { icon: 'coin', chip: '+$1', label: 'legendCoin' },
];
const TYPES: CardType[] = ['action', 'treasure', 'victory', 'curse', 'attack', 'reaction'];
const PILES: { icon: IconName; label: UiKey }[] = [
  { icon: 'hand', label: 'hand' },
  { icon: 'deck', label: 'deck' },
  { icon: 'discard', label: 'discardPile' },
];

interface Props {
  /** Also explain the hand/deck/discard counters shown on the board. */
  piles?: boolean;
}

/** What the little icons on cards and counters mean. */
export function Legend({ piles = false }: Props) {
  const { tr } = useLang();
  return (
    <details className="legend" open>
      <summary>
        <Icon name="info" />
        {tr.t('legend')}
      </summary>
      <ul className="legend__list">
        {BONUSES.map((b) => (
          <li key={b.icon}>
            <span className="chip">
              <Icon name={b.icon} />
              {b.chip}
            </span>
            {tr.t(b.label)}
          </li>
        ))}
        <li>
          <span className="coin">3</span>
          {tr.t('legendCost')}
        </li>
        {piles &&
          PILES.map((p) => (
            <li key={p.icon}>
              <Icon name={p.icon} />
              {tr.t(p.label)}
            </li>
          ))}
      </ul>
      <ul className="legend__list">
        {TYPES.map((type) => (
          <li key={type}>
            <span className={`legend__swatch card--${type}`} />
            {tr.cardType(type)}
          </li>
        ))}
      </ul>
    </details>
  );
}
