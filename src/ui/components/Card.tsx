import { getCard } from '../../cards/registry';
import type { CardId } from '../../engine/types';
import { useLang } from '../../i18n/LangProvider';
import { splitRuleText, type RuleChip } from '../../theme';
import { primaryType } from '../format';
import { Icon } from './Icon';

interface Props {
  id: CardId;
  size?: 'normal' | 'small' | 'big';
  highlight?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  /** Cards left in a pile. */
  count?: number;
  /** Position in an "order these cards" prompt. */
  order?: number;
  onClick?: () => void;
}

/** Text like "$2" or "6 PV" is shown large instead of as rule text. */
const VALUE_TEXT = /^-?\$?\d+( PV| VP)?$/;
/** Names longer than this get a smaller type size instead of breaking mid-word. */
const LONG_NAME = 10;
/** Rule texts longer than this are clipped on the normal card; the full text is in the title and the preview. */
const LONG_TEXT = 120;

export function Chips({ chips }: { chips: RuleChip[] }) {
  if (chips.length === 0) return null;
  return (
    <span className="chips" aria-hidden="true">
      {chips.map((c, i) => (
        <span key={i} className="chip">
          <Icon name={c.kind} />
          {c.kind === 'coin' ? `+$${c.n}` : `+${c.n}`}
        </span>
      ))}
    </span>
  );
}

export function Card({ id, size = 'normal', highlight, selected, dimmed, count, order, onClick }: Props) {
  const { tr } = useLang();
  const def = getCard(id);
  const name = tr.card(id);
  const text = tr.cardText(id);
  const types = def.types.map((ty) => tr.cardType(ty)).join(' · ');
  const isValue = VALUE_TEXT.test(text);
  const { chips, rest } = splitRuleText(text);
  const className = [
    'card',
    `card--${primaryType(id)}`,
    `card--${size}`,
    highlight && 'is-highlight',
    selected && 'is-selected',
    dimmed && 'is-dimmed',
    onClick && 'is-clickable',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={!onClick}
      title={`${name}: ${text}`}
      aria-label={`${name}, $${def.cost}. ${types}. ${text}`}
      aria-pressed={selected === undefined ? undefined : selected}
    >
      <span className="card__cost" aria-hidden="true">{def.cost}</span>
      {count !== undefined && <span className="card__count">{count}</span>}
      {selected && order === undefined && (
        <span className="card__check">
          <Icon name="check" />
        </span>
      )}
      <span className="card__art" aria-hidden="true">
        <span className="card__mono">{def.types.includes('treasure') && isValue ? text : name.charAt(0)}</span>
      </span>
      <span className="card__name" data-long={name.length > LONG_NAME || undefined}>
        {name}
      </span>
      {size !== 'small' && (
        <span className="card__body" aria-hidden="true">
          {isValue ? (
            <span className="card__big">{text}</span>
          ) : (
            <>
              <Chips chips={chips} />
              {rest && <span className="card__text">{rest}</span>}
            </>
          )}
        </span>
      )}
      {size === 'normal' && rest.length > LONG_TEXT && <span className="card__more" aria-hidden="true">i</span>}
      <span className="card__types" aria-hidden="true">{types}</span>
      {order !== undefined && <span className="card__order">{order}</span>}
    </button>
  );
}
