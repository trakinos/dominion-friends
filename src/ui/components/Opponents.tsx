import type { PlayerView } from '../../engine/view';
import { cardName } from '../../theme';

interface Props {
  view: PlayerView;
  online(playerIndex: number): boolean;
}

export function Opponents({ view, online }: Props) {
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
              Hand {p.handCount} · Deck {p.deckCount} · Discard {p.discardCount}
              {p.discardTop ? ` (${cardName(p.discardTop)})` : ''}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
