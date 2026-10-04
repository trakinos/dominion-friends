import { useState } from 'react';
import type { Intent } from '../../engine/types';
import type { PlayerView } from '../../engine/view';
import type { LobbyState } from '../../net/protocol';
import { useLang } from '../../i18n/LangProvider';
import { Card } from '../components/Card';
import { Hand } from '../components/Hand';
import { Log } from '../components/Log';
import { Opponents } from '../components/Opponents';
import { PromptPanel } from '../components/PromptPanel';
import { Supply } from '../components/Supply';
import { TurnBar } from '../components/TurnBar';
import { buyablePiles, intentForHandCard, isMyTurn, playableHand } from '../moves';

type Tab = 'hand' | 'supply' | 'log';
const TABS: { id: Tab; label: 'tabHand' | 'tabSupply' | 'tabLog' }[] = [
  { id: 'hand', label: 'tabHand' },
  { id: 'supply', label: 'tabSupply' },
  { id: 'log', label: 'tabLog' },
];

interface Props {
  view: PlayerView;
  lobby: LobbyState;
  error: string | null;
  onIntent(intent: Intent): void;
  onDismissError(): void;
  /** Only passed to the host: ends the game for everyone. */
  onEndGame?(): void;
}

export function Board({ view, lobby, error, onIntent, onDismissError, onEndGame }: Props) {
  const { tr } = useLang();
  const [tab, setTab] = useState<Tab>('hand');
  const names = view.players.map((p) => p.name);
  const online = (i: number) => lobby.players.find((p) => p.id === view.players[i].id)?.online ?? false;
  const current = view.players[view.turn.player];
  const me = view.players[view.you];

  return (
    <main className={`board board--tab-${tab}`}>
      <nav className="board__tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>
            {tr.t(t.label)}
          </button>
        ))}
      </nav>

      <section className="board__supply">
        <Supply view={view} buyable={buyablePiles(view)} onBuy={(card) => onIntent({ type: 'buy', card })} />
      </section>

      <section className="board__opponents">
        <Opponents view={view} online={online} />
      </section>

      <section className="board__play">
        <h3>{isMyTurn(view) ? tr.t('yourPlayArea') : tr.t('playArea', { name: current.name })}</h3>
        <div className="card-row">
          {current.inPlay.map((id, i) => (
            <Card key={i} id={id} size="small" />
          ))}
        </div>
      </section>

      <section className="board__log">
        <Log entries={view.log} names={names} />
      </section>

      <section className="board__turn">
        <TurnBar
          view={view}
          names={names}
          onPlayAll={() => onIntent({ type: 'playAllTreasures' })}
          onEndPhase={() => onIntent({ type: 'endPhase' })}
        />
        {onEndGame && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(tr.t('endGameConfirm'))) onEndGame();
            }}
          >
            {tr.t('endGame')}
          </button>
        )}
        {view.waitingOn && (
          <div className="banner">
            {tr.t('waitingFor', {
              name: names[view.waitingOn.player] + (online(view.waitingOn.player) ? '' : ` ${tr.t('offlineSuffix')}`),
              message: tr.prompt(view.waitingOn),
            })}
          </div>
        )}
        {!view.waitingOn && !isMyTurn(view) && !online(view.turn.player) && (
          <div className="banner">{tr.t('waitingForOffline', { name: current.name })}</div>
        )}
        {error && (
          <div className="toast" role="alert">
            <span>{tr.reason(error)}</span>
            <button type="button" onClick={onDismissError} aria-label={tr.t('dismiss')}>
              ×
            </button>
          </div>
        )}
      </section>

      <section className="board__hand">
        <Hand
          cards={view.hand}
          playable={playableHand(view)}
          onPlay={(i) => {
            const intent = intentForHandCard(view, i);
            if (intent) onIntent(intent);
          }}
        />
        <div className="piles muted">
          {tr.t('deckDiscard', { deck: me.deckCount, discard: me.discardCount })}
          {me.discardTop && ` ${tr.t('discardTop', { card: tr.card(me.discardTop) })}`}
        </div>
      </section>

      {view.prompt && (
        <PromptPanel
          key={JSON.stringify(view.prompt)}
          prompt={view.prompt}
          onAnswer={(answer) => onIntent({ type: 'answerPrompt', answer })}
        />
      )}
    </main>
  );
}
