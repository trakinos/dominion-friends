import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../../net/protocol';
import { useLang } from '../../i18n/LangProvider';
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
  const { tr } = useLang();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
  const cleanCode = normalizeRoomCode(code);
  return (
    <main className="screen home">
      <div>
        <h1>Dominion Friends</h1>
        <p className="muted">{tr.t('tagline')}</p>
      </div>
      <label className="field">
        {tr.t('yourName')}
        <input value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} placeholder={tr.t('namePlaceholder')} />
      </label>
      <div className="home__choices">
        <section className="panel">
          <h2>{tr.t('hostTitle')}</h2>
          <p className="muted">{tr.t('hostBlurb')}</p>
          <button type="button" className="primary" disabled={busy} onClick={() => onHost(name)}>
            {tr.t('hostButton')}
          </button>
        </section>
        <section className="panel">
          <h2>{tr.t('joinTitle')}</h2>
          <label className="field">
            {tr.t('roomCode')}
            <input
              value={code}
              maxLength={CODE_LENGTH}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
              autoCapitalize="characters"
            />
          </label>
          <button type="button" className="primary" disabled={busy || !cleanCode} onClick={() => cleanCode && onJoin(cleanCode, name)}>
            {tr.t('joinButton')}
          </button>
        </section>
      </div>
      {busy && <p className="muted">{tr.t('connecting')}</p>}
      {error && (
        <p className="error" role="alert">
          {tr.reason(error)}
        </p>
      )}
    </main>
  );
}
