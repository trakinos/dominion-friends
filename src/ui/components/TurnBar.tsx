import type { PlayerView } from '../../engine/view';
import { useLang } from '../../i18n/LangProvider';
import { canPlayAllTreasures, isMyTurn } from '../moves';
import { Icon } from './Icon';

interface Props {
  view: PlayerView;
  names: string[];
  onPlayAll(): void;
  onEndPhase(): void;
}

export function TurnBar({ view, names, onPlayAll, onEndPhase }: Props) {
  const { tr } = useLang();
  const mine = isMyTurn(view);
  const idle = mine && view.prompt === null && view.waitingOn === null;
  const t = view.turn;
  return (
    <div className="turnbar">
      {/* keyed on the player so the pill pops in again at every turn change */}
      <strong key={t.player} className={`turn-pill ${mine ? '' : 'is-other'}`} aria-live="polite">
        {mine ? tr.t('yourTurn') : tr.t('turnOf', { name: names[t.player] })}
      </strong>
      <ol className="phases">
        <li className={t.phase === 'action' ? 'is-on' : ''} aria-current={t.phase === 'action' ? 'step' : undefined}>
          {tr.t('actionPhase')}
        </li>
        <li className={t.phase === 'buy' ? 'is-on' : ''} aria-current={t.phase === 'buy' ? 'step' : undefined}>
          {tr.t('buyPhase')}
        </li>
      </ol>
      <div className="counters">
        <span className="ctr">
          <Icon name="action" />
          <b>{t.actions}</b>
          {tr.t('actions')}
        </span>
        <span className="ctr">
          <Icon name="buy" />
          <b>{t.buys}</b>
          {tr.t('buys')}
        </span>
        <span className="ctr">
          <Icon name="coin" />
          <b>{'$' + t.coins}</b>
        </span>
      </div>
      {idle && (
        <div className="turnbar__btns">
          <button type="button" disabled={!canPlayAllTreasures(view)} onClick={onPlayAll}>
            <Icon name="coin" />
            {tr.t('playAllTreasures')}
          </button>
          <button type="button" className="primary" onClick={onEndPhase}>
            {t.phase === 'action' ? tr.t('endActions') : tr.t('endTurn')}
          </button>
        </div>
      )}
    </div>
  );
}
