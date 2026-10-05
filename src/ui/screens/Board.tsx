import { useEffect, useRef, useState } from 'react';
import type { Intent } from '../../engine/types';
import type { PlayerView } from '../../engine/view';
import type { LobbyState } from '../../net/protocol';
import { useLang } from '../../i18n/LangProvider';
import { Card } from '../components/Card';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Hand } from '../components/Hand';
import { Legend } from '../components/Legend';
import { Icon } from '../components/Icon';
import { Log } from '../components/Log';
import { Opponents } from '../components/Opponents';
import { PromptPanel } from '../components/PromptPanel';
import { Supply } from '../components/Supply';
import { TurnBar } from '../components/TurnBar';
import { EMPTY_PILES_TO_END, buyablePiles, endGameStatus, hasNoActionToPlay, intentForHandCard, isMyTurn, playableHand } from '../moves';

type Tab = 'hand' | 'supply' | 'log';
const TABS: { id: Tab; label: 'tabHand' | 'tabSupply' | 'tabLog' }[] = [
  { id: 'hand', label: 'tabHand' },
  { id: 'supply', label: 'tabSupply' },
  { id: 'log', label: 'tabLog' },
];
/** Refused-move toasts dismiss themselves after this long. */
const TOAST_MS = 5000;

interface Props {
  view: PlayerView;
  lobby: LobbyState;
  code: string;
  error: string | null;
  onIntent(intent: Intent): void;
  onDismissError(): void;
  /** Only passed to the host: ends the game for everyone. */
  onEndGame?(): void;
}

export function Board({ view, lobby, code, error, onIntent, onDismissError, onEndGame }: Props) {
  const { tr } = useLang();
  const [tab, setTab] = useState<Tab>('hand');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [endInfo, setEndInfo] = useState(false);
  const ending = endGameStatus(view);
  const province = tr.card('province');
  const noAction = hasNoActionToPlay(view);
  const menu = useRef<HTMLDetailsElement>(null);
  const names = view.players.map((p) => p.name);
  const online = (i: number) => lobby.players.find((p) => p.id === view.players[i].id)?.online ?? false;
  const current = view.players[view.turn.player];
  const me = view.players[view.you];
  const mine = isMyTurn(view);
  const idle = mine && view.prompt === null && view.waitingOn === null;

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(onDismissError, TOAST_MS);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <main className={`board board--tab-${tab}`}>
      <header className="board__top">
        <div className="brand">
          {tr.t('appName')}
          <span className="room">{code}</span>
        </div>
        <Opponents view={view} online={online} />
        {onEndGame && (
          <details className="menu" ref={menu}>
            <summary aria-label={tr.t('moreOptions')} title={tr.t('moreOptions')}>
              <Icon name="more" />
            </summary>
            <div className="menu__list">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (menu.current) menu.current.open = false;
                  setConfirmEnd(true);
                }}
              >
                <Icon name="x" />
                {tr.t('endGame')}…
              </button>
            </div>
          </details>
        )}
      </header>

      <nav className="board__tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'is-active' : ''} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {tr.t(t.label)}
          </button>
        ))}
      </nav>

      <section className="board__supply zone" aria-label={tr.t('tabSupply')}>
        <div className="zone__head">
          <h2>{tr.t('tabSupply')}</h2>
          <span className="zone__hint">{tr.t('supplyHint')}</span>
          <span className="endgame">
            <Icon name="trophy" />
            <b>{tr.t('endGameTitleShort')}</b>
            {tr.t('endGameStatus', { province, left: ending.provincesLeft, empty: ending.emptyPiles, max: EMPTY_PILES_TO_END })}
            <button
              type="button"
              className={`info-btn ${endInfo ? 'is-open' : ''}`}
              aria-label={tr.t('endGameTitleShort')}
              title={tr.t('endGameTitleShort')}
              aria-expanded={endInfo}
              onClick={() => setEndInfo(!endInfo)}
            >
              <Icon name="info" />
            </button>
          </span>
        </div>
        {endInfo && (
          <div className="banner banner--info" role="note">
            <Icon name="info" />
            <span>{tr.t('endGameInfo', { province, max: EMPTY_PILES_TO_END })}</span>
            <button type="button" className="banner__close" onClick={() => setEndInfo(false)} aria-label={tr.t('dismiss')}>
              <Icon name="x" />
            </button>
          </div>
        )}
        <Legend piles />
        <Supply
          view={view}
          buyable={buyablePiles(view)}
          buying={idle && view.turn.phase === 'buy'}
          onBuy={(card) => onIntent({ type: 'buy', card })}
        />
      </section>

      <section className="board__log zone" aria-label={tr.t('gameLog')}>
        <div className="zone__head">
          <h2>{tr.t('tabLog')}</h2>
        </div>
        <Log entries={view.log} names={names} />
      </section>

      <section className="board__play zone">
        <div className="zone__head">
          <h2>{mine ? tr.t('yourPlayArea') : tr.t('playArea', { name: current.name })}</h2>
          <span className="zone__hint">{tr.t('playAreaHint')}</span>
        </div>
        <div className="table-row">
          {current.inPlay.map((id, i) => (
            <Card key={i} id={id} size="small" />
          ))}
          <div className="trash">
            <span className="trash__slot">
              <Icon name="trash" />
            </span>
            {tr.t('trash')} · {view.trash.length}
          </div>
        </div>
      </section>

      <div className="board__dock">
        <section className="board__turn">
          <TurnBar
            view={view}
            names={names}
            onPlayAll={() => onIntent({ type: 'playAllTreasures' })}
            onEndPhase={() => onIntent({ type: 'endPhase' })}
          />
          {view.waitingOn && (
            <div className="banner">
              <Icon name="clock" />
              {tr.t('waitingFor', {
                name: names[view.waitingOn.player] + (online(view.waitingOn.player) ? '' : ` ${tr.t('offlineSuffix')}`),
                message: tr.prompt(view.waitingOn),
              })}
            </div>
          )}
          {!view.waitingOn && !mine && !online(view.turn.player) && (
            <div className="banner">
              <Icon name="clock" />
              {tr.t('waitingForOffline', { name: current.name })}
            </div>
          )}
        </section>

        <section className={`board__hand ${noAction ? 'has-cta' : ''}`} aria-label={tr.t('hand')}>
          {noAction && (
            <div className="hand-cta">
              <span>{tr.t('nothingToPlay')}</span>
              <button type="button" className="primary" onClick={() => onIntent({ type: 'endPhase' })}>
                {tr.t('endActions')}
                <Icon name="play" />
              </button>
            </div>
          )}
          <div className="stack">
            <div className={`cardback ${me.deckCount === 0 ? 'is-empty' : ''}`} />
            <span>
              <Icon name="deck" />
              {tr.t('deck')} {me.deckCount}
            </span>
          </div>
          <Hand
            cards={view.hand}
            playable={playableHand(view)}
            active={idle}
            onPlay={(i) => {
              const intent = intentForHandCard(view, i);
              if (intent) onIntent(intent);
            }}
          />
          <div className="stack">
            {me.discardTop ? <Card id={me.discardTop} size="small" /> : <div className="cardback is-empty" />}
            <span>
              <Icon name="discard" />
              {tr.t('discardPile')} {me.discardCount}
            </span>
          </div>
        </section>
      </div>

      {error && (
        <div className="toast" role="alert">
          <span className="toast__ic">
            <Icon name="alert" />
          </span>
          <span>{tr.reason(error)}</span>
          <button type="button" onClick={onDismissError} aria-label={tr.t('dismiss')}>
            <Icon name="x" />
          </button>
        </div>
      )}

      {view.prompt && (
        <PromptPanel
          key={JSON.stringify(view.prompt)}
          prompt={view.prompt}
          onAnswer={(answer) => onIntent({ type: 'answerPrompt', answer })}
        />
      )}

      {confirmEnd && onEndGame && (
        <ConfirmDialog
          title={tr.t('endGameTitle')}
          body={tr.t('endGameConfirm')}
          cancel={tr.t('keepPlaying')}
          confirm={tr.t('endGame')}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => {
            setConfirmEnd(false);
            onEndGame();
          }}
        />
      )}
    </main>
  );
}
