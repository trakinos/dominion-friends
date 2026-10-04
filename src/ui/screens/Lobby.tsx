import { useEffect, useState } from 'react';
import type { CardId } from '../../engine/types';
import type { HostSession } from '../../net/host';
import type { LobbyState } from '../../net/protocol';
import { useLang } from '../../i18n/LangProvider';
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
    setStartError(result.ok ? null : tr.reason(result.reason));
  }

  const enoughPlayers = lobby.players.length >= 2;
  return (
    <main className="screen lobby">
      <header className="lobby__header">
        <h1>{tr.t('room', { code })}</h1>
        <button type="button" onClick={onLeave}>
          {tr.t('leave')}
        </button>
      </header>

      <section className="panel">
        <h2>{tr.t('invite')}</h2>
        <div className="share">
          <input readOnly value={shareLink} onFocus={(e) => e.currentTarget.select()} aria-label={tr.t('shareLink')} />
          <button type="button" onClick={copy}>
            {copied ? tr.t('copied') : tr.t('copyLink')}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>{tr.t('players', { n: lobby.players.length })}</h2>
        <ul className="seats">
          {lobby.players.map((p) => (
            <li key={p.id}>
              <span className={`dot ${p.online ? 'dot--on' : ''}`} />
              {p.name}
              {p.id === lobby.hostId && ` ${tr.t('hostTag')}`}
              {p.id === me && ` ${tr.t('youTag')}`}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>{tr.t('kingdom')}</h2>
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
            {tr.t('startGame')}
          </button>
          {!enoughPlayers && <span className="muted">{tr.t('needPlayer')}</span>}
          {draft.length !== 10 && <span className="muted">{tr.t('choose10')}</span>}
          {startError && <p className="error">{startError}</p>}
        </div>
      ) : (
        <p className="muted">{tr.t('waitingHostStart')}</p>
      )}
    </main>
  );
}
