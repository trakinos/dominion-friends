import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../../net/protocol';
import { CODE_LENGTH, normalizeRoomCode } from '../../net/roomCode';

interface Props {
  initialName: string;
  initialCode: string;
  busy: boolean;
  error: string | null;
  onHost(name: string): void;
  onJoin(code: string, name: string): void;
}

export function Home({ initialName, initialCode, busy, error, onHost, onJoin }: Props) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
  const cleanCode = normalizeRoomCode(code);
  return (
    <main className="screen home">
      <div>
        <h1>Dominion Friends</h1>
        <p className="muted">A deck-building card game for 2–4 friends.</p>
      </div>
      <label className="field">
        Your name
        <input value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} placeholder="Player" />
      </label>
      <div className="home__choices">
        <section className="panel">
          <h2>Host a game</h2>
          <p className="muted">Create a room and share the link with your friends.</p>
          <button type="button" className="primary" disabled={busy} onClick={() => onHost(name)}>
            Host game
          </button>
        </section>
        <section className="panel">
          <h2>Join a game</h2>
          <label className="field">
            Room code
            <input
              value={code}
              maxLength={CODE_LENGTH}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
              autoCapitalize="characters"
            />
          </label>
          <button type="button" className="primary" disabled={busy || !cleanCode} onClick={() => cleanCode && onJoin(cleanCode, name)}>
            Join
          </button>
        </section>
      </div>
      {busy && <p className="muted">Connecting…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
