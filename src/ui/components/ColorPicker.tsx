import type { UiKey } from '../../i18n';
import { useLang } from '../../i18n/LangProvider';
import { PLAYER_COLORS, type PlayerColorId } from '../../theme/playerColors';

const LABELS: Record<PlayerColorId, UiKey> = {
  blue: 'colorBlue', red: 'colorRed', teal: 'colorTeal', amber: 'colorAmber',
  green: 'colorGreen', purple: 'colorPurple', pink: 'colorPink', slate: 'colorSlate',
};

interface Props {
  value: PlayerColorId;
  /** Colors other players hold. */
  taken: PlayerColorId[];
  onPick(color: PlayerColorId): void;
}

export function ColorPicker({ value, taken, onPick }: Props) {
  const { tr } = useLang();
  return (
    <div className="swatches" role="radiogroup" aria-label={tr.t('yourColor')}>
      {PLAYER_COLORS.map((c) => {
        const isTaken = taken.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.id === value}
            aria-label={tr.t(LABELS[c.id])}
            title={tr.t(LABELS[c.id])}
            className={`swatch ${c.id === value ? 'is-on' : ''}`}
            style={{ background: c.hex }}
            disabled={isTaken}
            onClick={() => onPick(c.id)}
          />
        );
      })}
    </div>
  );
}
