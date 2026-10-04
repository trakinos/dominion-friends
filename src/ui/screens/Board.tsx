import { useState } from 'react';
import type { Intent } from '../../engine/types';
import type { PlayerView } from '../../engine/view';
import type { LobbyState } from '../../net/protocol';
import { cardName } from '../../theme';
import { Card } from '../components/Card';
import { Hand } from '../components/Hand';
import { Log } from '../components/Log';
import { Opponents } from '../components/Opponents';
import { PromptPanel } from '../components/PromptPanel';
import { Supply } from '../components/Supply';
import { TurnBar } from '../components/TurnBar';
import { buyablePiles, intentForHandCard, isMyTurn, playableHand } from '../moves';

type Tab = 'hand' | 'supply' | 'log';
const TABS: { id: Tab; label: string }[] = [
  { id: 'hand', label: 'Hand' },
  { id: 'supply', label: 'Supply' },
  { id: 'log', label: 'Log' },
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
            {t.label}
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
        <h3>{isMyTurn(view) ? 'Your play area' : `${current.name}'s play area`}</h3>
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
              if (window.confirm('End the game for everyone and return to the lobby?')) onEndGame();
            }}
          >
            End game
          </button>
        )}
        {view.waitingOn && (
          <div className="banner">
            Waiting for {names[view.waitingOn.player]}
            {online(view.waitingOn.player) ? '' : ' (offline)'}: {view.waitingOn.message}
          </div>
        )}
        {!view.waitingOn && !isMyTurn(view) && !online(view.turn.player) && (
          <div className="banner">Waiting for {current.name} (offline)…</div>
        )}
        {error && (
          <div className="toast" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onDismissError} aria-label="Dismiss">
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
          Deck {me.deckCount} · Discard {me.discardCount}
          {me.discardTop && ` (top: ${cardName(me.discardTop)})`}
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
