import type { PlayerView } from '../../engine/view';
import { canPlayAllTreasures, isMyTurn } from '../moves';

interface Props {
  view: PlayerView;
  names: string[];
  onPlayAll(): void;
  onEndPhase(): void;
}

export function TurnBar({ view, names, onPlayAll, onEndPhase }: Props) {
  const mine = isMyTurn(view);
  const idle = mine && view.prompt === null && view.waitingOn === null;
  const t = view.turn;
  return (
    <div className="turnbar">
      <strong>{mine ? 'Your turn' : `${names[t.player]}'s turn`}</strong>
      <span className="turnbar__phase">{t.phase === 'action' ? 'Action phase' : 'Buy phase'}</span>
      <span>Actions {t.actions}</span>
      <span>Buys {t.buys}</span>
      <span>{'$' + t.coins}</span>
      {idle && (
        <>
          <button type="button" disabled={!canPlayAllTreasures(view)} onClick={onPlayAll}>
            Play all Treasures
          </button>
          <button type="button" className="primary" onClick={onEndPhase}>
            {t.phase === 'action' ? 'End Actions' : 'End turn'}
          </button>
        </>
      )}
    </div>
  );
}
