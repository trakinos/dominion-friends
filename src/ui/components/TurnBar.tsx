import type { PlayerView } from '../../engine/view';
import { useLang } from '../../i18n/LangProvider';
import { canPlayAllTreasures, isMyTurn } from '../moves';

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
      <strong>{mine ? tr.t('yourTurn') : tr.t('turnOf', { name: names[t.player] })}</strong>
      <span className="turnbar__phase">{t.phase === 'action' ? tr.t('actionPhase') : tr.t('buyPhase')}</span>
      <span>{tr.t('actions', { n: t.actions })}</span>
      <span>{tr.t('buys', { n: t.buys })}</span>
      <span>{'$' + t.coins}</span>
      {idle && (
        <>
          <button type="button" disabled={!canPlayAllTreasures(view)} onClick={onPlayAll}>
            {tr.t('playAllTreasures')}
          </button>
          <button type="button" className="primary" onClick={onEndPhase}>
            {t.phase === 'action' ? tr.t('endActions') : tr.t('endTurn')}
          </button>
        </>
      )}
    </div>
  );
}
