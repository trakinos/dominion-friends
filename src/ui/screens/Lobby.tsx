import { useEffect, useState } from 'react';
import type { CardId } from '../../engine/types';
import type { HostSession } from '../../net/host';
import type { LobbyState } from '../../net/protocol';
import { Card } from '../components/Card';
import { KingdomPicker } from '../components/KingdomPicker';
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
  return (
    <main className="screen lobby">
      <header className="lobby__header">
        <h1>Room {code}</h1>
        <button type="button" onClick={onLeave}>
          Leave
        </button>
      </header>

      <section className="panel">
        <h2>Invite friends</h2>
        <div className="share">
          <input readOnly value={shareLink} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
          <button type="button" onClick={copy}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Players ({lobby.players.length}/4)</h2>
        <ul className="seats">
          {lobby.players.map((p) => (
            <li key={p.id}>
              <span className={`dot ${p.online ? 'dot--on' : ''}`} />
              {p.name}
              {p.id === lobby.hostId && ' (host)'}
              {p.id === me && ' (you)'}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Kingdom</h2>
        {host ? (
          <KingdomPicker selected={draft} onToggle={toggle} onRandomize={() => host.randomizeKingdom()} />
        ) : (
          <div className="card-row">
            {sortByCost(lobby.kingdom).map((id) => (
              <Card key={id} id={id} />
            ))}
          </div>
        )}
      </section>

      {host ? (
        <div className="actions">
          <button type="button" className="primary" disabled={!enoughPlayers || draft.length !== 10} onClick={start}>
            Start game
          </button>
          {!enoughPlayers && <span className="muted">Waiting for at least one more player…</span>}
          {draft.length !== 10 && <span className="muted">Choose 10 kingdom cards.</span>}
          {startError && <p className="error">{startError}</p>}
        </div>
      ) : (
        <p className="muted">Waiting for the host to start…</p>
      )}
    </main>
  );
}
