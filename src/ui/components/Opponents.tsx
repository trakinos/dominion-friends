import type { PlayerView } from '../../engine/view';
import { useLang } from '../../i18n/LangProvider';

interface Props {
  view: PlayerView;
  online(playerIndex: number): boolean;
}

export function Opponents({ view, online }: Props) {
  const { tr } = useLang();
  return (
    <ul className="opponents">
      {view.players.map((p, i) =>
        i === view.you ? null : (
          <li key={p.id} className={i === view.turn.player ? 'is-current' : ''}>
            <span>
              <span className={`dot ${online(i) ? 'dot--on' : ''}`} />
              <strong>{p.name}</strong>
            </span>
            <span className="muted">
              {tr.t('oppCounts', { hand: p.handCount, deck: p.deckCount, discard: p.discardCount })}
              {p.discardTop ? ` (${tr.card(p.discardTop)})` : ''}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
