import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../../net/protocol';
import { useLang } from '../../i18n/LangProvider';
import { CODE_LENGTH, normalizeRoomCode } from '../../net/roomCode';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';

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
  // Opened from an invite link: joining is the only thing to do here.
  const [invited, setInvited] = useState(initialCode !== '');
  const cleanCode = normalizeRoomCode(code);
  return (
    <main className="screen home">
      <div className="home__hero">
        <div>
          <span className="pill pill--stripe">2–4</span>
          <h1 className="home__title">{tr.t('appName')}</h1>
          <p className="home__tagline">{tr.t('tagline')}</p>
          <label className="field home__name">
            {tr.t('yourName')}
            <input value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} placeholder={tr.t('namePlaceholder')} />
          </label>
          <div className={`home__choices ${invited ? 'home__choices--single' : ''}`}>
            {!invited && (
              <section className="panel">
                <h2>{tr.t('hostTitle')}</h2>
                <p>{tr.t('hostBlurb')}</p>
                <button type="button" className="primary lg wide" disabled={busy} onClick={() => onHost(name)}>
                  <Icon name="play" />
                  {tr.t('hostButton')}
                </button>
              </section>
            )}
            <section className="panel">
              <h2>{invited ? tr.t('invitedTitle') : tr.t('joinTitle')}</h2>
              <label className="field">
                {tr.t('roomCode')}
                <input
                  className="input--code"
                  value={code}
                  maxLength={CODE_LENGTH}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABCD"
                  autoCapitalize="characters"
                  aria-invalid={error ? true : undefined}
                />
              </label>
              <button
                type="button"
                className={`lg wide ${invited ? 'primary' : ''}`}
                disabled={busy || !cleanCode}
                onClick={() => cleanCode && onJoin(cleanCode, name)}
              >
                {invited && <Icon name="play" />}
                {tr.t('joinButton')}
              </button>
              {invited && (
                <button
                  type="button"
                  className="link"
                  disabled={busy}
                  onClick={() => {
                    setInvited(false);
                    setCode('');
                    history.replaceState(null, '', location.pathname + location.search);
                  }}
                >
                  {tr.t('hostInstead')}
                </button>
              )}
            </section>
          </div>
          {busy && <p className="home__status muted">{tr.t('connecting')}</p>}
          {error && (
            <p className="err home__status" role="alert">
              <Icon name="alert" />
              {tr.reason(error)}
            </p>
          )}
        </div>
        <div className="fan" aria-hidden="true">
          <Card id="copper" size="big" />
          <Card id="village" size="big" />
          <Card id="province" size="big" />
        </div>
      </div>
    </main>
  );
}
