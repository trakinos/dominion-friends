import type { PlayerView } from '../../engine/view';
import { useLang } from '../../i18n/LangProvider';
import { primaryType } from '../format';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

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
            <Avatar name={p.name} seat={i} online={online(i)} />
            <span>
              <span className="seat__name">{p.name}</span>
              <span className="seat__tag">{i === view.turn.player ? tr.t('onTurn') : online(i) ? tr.t('online') : tr.t('offline')}</span>
            </span>
            <span className="stats">
              <span title={tr.t('hand')}>
                <Icon name="hand" />
                <span className="sr-only">{tr.t('hand')}</span>
                {p.handCount}
              </span>
              <span title={tr.t('deck')}>
                <Icon name="deck" />
                <span className="sr-only">{tr.t('deck')}</span>
                {p.deckCount}
              </span>
              <span title={tr.t('discardPile')}>
                <Icon name="discard" />
                <span className="sr-only">{tr.t('discardPile')}</span>
                {p.discardCount}
              </span>
            </span>
            {p.discardTop && <span className={`lchip lchip--${primaryType(p.discardTop)}`}>{tr.card(p.discardTop)}</span>}
          </li>
        ),
      )}
    </ul>
  );
}
