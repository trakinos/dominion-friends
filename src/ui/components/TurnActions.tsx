import type { PlayerView } from '../../engine/view';
import { useLang } from '../../i18n/LangProvider';
import { canPlayAllTreasures, isMyTurn } from '../moves';
import { Icon } from './Icon';

interface Props {
  view: PlayerView;
  onPlayAll(): void;
  onEndPhase(): void;
}

/** Your turn buttons. Renders nothing on other players' turns or while a choice is open. */
export function TurnActions({ view, onPlayAll, onEndPhase }: Props) {
  const { tr } = useLang();
  if (!isMyTurn(view) || view.prompt !== null || view.waitingOn !== null) return null;
  return (
    <div className="turn-actions">
      <button type="button" disabled={!canPlayAllTreasures(view)} onClick={onPlayAll}>
        <Icon name="coin" />
        {tr.t('playAllTreasures')}
      </button>
      <button type="button" className="primary" onClick={onEndPhase}>
        {view.turn.phase === 'action' ? tr.t('endActions') : tr.t('endTurn')}
      </button>
    </div>
  );
}
