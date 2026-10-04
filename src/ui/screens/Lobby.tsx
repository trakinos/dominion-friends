import { useEffect, useState } from 'react';
import type { CardId } from '../../engine/types';
import { MAX_PLAYERS, type HostSession } from '../../net/host';
import type { LobbyState } from '../../net/protocol';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { KingdomPicker } from '../components/KingdomPicker';
import { Pile } from '../components/Pile';
import { sortByCost } from '../moves';

interface Props {
  lobby: LobbyState;
  me: string;
  code: string;
  shareLink: string;
  host: HostSession | null;
  onLeave(): void;
}

export function Lobby({ lobby, me, code, shareLink, host, onLeave }: Props) {
  const { tr } = useLang();
  const [draft, setDraft] = useState<CardId[]>(lobby.kingdom);
  const [startError, setStartError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const kingdomKey = lobby.kingdom.join(',');
  useEffect(() => setDraft(lobby.kingdom), [kingdomKey]);

  function toggle(id: CardId) {
    const next = draft.includes(id) ? draft.filter((c) => c !== id) : draft.length < 10 ? [...draft, id] : draft;
    setDraft(next);
    if (next.length === 10) host?.setKingdom(next);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the link stays visible in the field to copy by hand.
    }
  }

  function start() {
    if (!host) return;
    const result = host.start();
    setStartError(result.ok ? null : result.reason);
  }

  const enoughPlayers = lobby.players.length >= 2;
  const canStart = enoughPlayers && draft.length === 10;
  const openSeats = Math.max(0, MAX_PLAYERS - lobby.players.length);
  return (
    <main className="screen lobby">
      <header className="lobby__header">
        <h1>{tr.t('room', { code })}</h1>
        <button type="button" onClick={onLeave}>
          <Icon name="door" />
          {tr.t('leave')}
        </button>
      </header>

      <div className="lobby__grid">
        <div className="lobby__side">
          <section className="panel">
            <h2>{tr.t('invite')}</h2>
            <p>{tr.t('inviteBlurb', { code })}</p>
            <div className="share">
              <input readOnly value={shareLink} onFocus={(e) => e.currentTarget.select()} aria-label={tr.t('shareLink')} />
              <button type="button" className="primary" onClick={copy}>
                <Icon name={copied ? 'check' : 'copy'} />
                {copied ? tr.t('copied') : tr.t('copyLink')}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="picker__bar" style={{ marginBottom: 0 }}>
              <h2>{tr.t('players')}</h2>
              <span className="picker__count" style={{ marginLeft: 'auto' }}>
                {lobby.players.length}/{MAX_PLAYERS}
              </span>
            </div>
            <ul className="seats">
              {lobby.players.map((p, i) => (
                <li key={p.id}>
                  <Avatar name={p.name} seat={i} />
                  <span className="seats__name">{p.name}</span>
                  {p.id === lobby.hostId && <span className="pill">{tr.t('hostTag')}</span>}
                  {p.id === me && <span className="pill pill--accent">{tr.t('youTag')}</span>}
                  <span className="seats__status">
                    <span className={`dot ${p.online ? 'dot--on' : ''}`} />
                    {p.online ? tr.t('online') : tr.t('offline')}
                  </span>
                </li>
              ))}
              {Array.from({ length: openSeats }, (_, i) => (
                <li key={`open-${i}`} className="is-empty">
                  <span className="seats__ghost" />
                  {tr.t('emptySeat')}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="panel">
          {host ? (
            <KingdomPicker selected={draft} onToggle={toggle} onRandomize={() => host.randomizeKingdom()} />
          ) : (
            <>
              <div className="picker__bar">
                <h2>{tr.t('kingdom')}</h2>
                <span className="zone__hint">{tr.t('kingdomByHost')}</span>
              </div>
              <div className="pile-grid">
                {sortByCost(lobby.kingdom).map((id) => (
                  <Pile key={id} id={id} showTypes />
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {host ? (
        <div className="startbar">
          <div className="startbar__info">
            <strong>{canStart ? tr.t('readyToStart') : !enoughPlayers ? tr.t('needPlayer') : tr.t('choose10')}</strong>
            <span>{tr.t('startSummary', { players: lobby.players.length, cards: draft.length })}</span>
            {startError && <span className="error">{tr.reason(startError)}</span>}
          </div>
          <button type="button" className="primary lg" disabled={!canStart} onClick={start}>
            <Icon name="play" />
            {tr.t('startGame')}
          </button>
        </div>
      ) : (
        <div className="banner">
          <Icon name="clock" />
          {tr.t('waitingHostStart')}
        </div>
      )}
    </main>
  );
}
