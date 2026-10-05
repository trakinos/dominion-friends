import { useEffect, useState } from 'react';
import { describePeerError } from '../net/errors';
import { codeFromHash, joinLink } from '../net/roomCode';
import { useLang } from '../i18n/LangProvider';
import { Centered } from './components/Centered';
import { hostGame, joinGame, type ActiveSession } from './connect';
import { Board } from './screens/Board';
import { EndScreen } from './screens/EndScreen';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Icon } from './components/Icon';
import { LangToggle } from './components/LangToggle';
import { Loader } from './components/Loader';
import { loadName, saveName } from './storage';
import { useGuestState } from './useGuestState';

export function App() {
  const { tr } = useLang();
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = useGuestState(active?.session ?? null);

  // A refused join (room full, game in progress) sends the player back to the home screen.
  useEffect(() => {
    if (state?.status !== 'rejected') return;
    setError(state.error);
    active?.close();
    setActive(null);
  }, [state?.status]);

  // Closing the host's tab ends the game for everyone, so ask first.
  useEffect(() => {
    if (!active?.host) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    // pagehide tears the peer down cleanly so guests see the host leave right away.
    const leave = () => active.close();
    window.addEventListener('beforeunload', warn);
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('pagehide', leave);
    };
  }, [active]);

  async function connect(name: string, open: () => Promise<ActiveSession>) {
    saveName(name);
    setBusy(true);
    setError(null);
    try {
      setActive(await open());
    } catch (err) {
      setError(describePeerError(err));
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    active?.close();
    setActive(null);
    setError(null);
    history.replaceState(null, '', location.pathname);
  }

  function renderScreen() {
    if (!active || !state || state.status === 'rejected') {
      return (
        <Home
          initialName={loadName()}
          initialCode={codeFromHash(location.hash) ?? ''}
          busy={busy}
          error={state?.status === 'rejected' ? state.error : error}
          onHost={(name) => connect(name, () => hostGame(name))}
          onJoin={(code, name) =>
            connect(name, async () => {
              const session = await joinGame(code, name);
              history.replaceState(null, '', `#join=${code}`);
              return session;
            })
          }
        />
      );
    }

    // Only guests reach this: the host's own connection is in-memory and never drops.
    if (state.status === 'disconnected') {
      const code = active.code;
      const name = loadName();
      return (
        <Centered>
          <div className="sig" aria-hidden="true">
            <Icon name="wifiOff" />
          </div>
          <h1>{tr.t('connectionLost')}</h1>
          <p className="muted">{tr.t('connectionLostBody')}</p>
          {error && (
            <p className="error" role="alert">
              {tr.reason(error)}
            </p>
          )}
          <div className="actions actions--center">
            <button type="button" className="primary" disabled={busy} onClick={() => {
                active.close();
                void connect(name, () => joinGame(code, name));
              }}>
              <Icon name="refresh" />
              {busy ? tr.t('rejoining') : tr.t('rejoin')}
            </button>
            <button type="button" disabled={busy} onClick={leave}>
              {tr.t('backToStart')}
            </button>
          </div>
        </Centered>
      );
    }

    if (state.status === 'connecting' || !state.lobby || !state.playerId) {
      return (
        <Centered>
          <Loader />
          <h2>{tr.t('joiningRoom', { code: active.code })}</h2>
        </Centered>
      );
    }

    if (!state.lobby.inGame) {
      return (
        <Lobby
          lobby={state.lobby}
          me={state.playerId}
          code={active.code}
          shareLink={joinLink(location.origin + location.pathname, active.code)}
          host={active.host}
          onSetColor={(c) => active.session.setColor(c)}
          onLeave={leave}
        />
      );
    }

    if (!state.view) {
      return (
        <Centered>
          <Loader />
          <h2>{tr.t('startingGame')}</h2>
        </Centered>
      );
    }

    if (state.view.result) {
      return (
        <EndScreen
          result={state.view.result}
          lobby={state.lobby}
          isHost={active.host !== null}
          onPlayAgain={() => active.host?.playAgain()}
          onBackToLobby={() => active.host?.backToLobby()}
          onLeave={leave}
        />
      );
    }

    return (
      <Board
        view={state.view}
        lobby={state.lobby}
        code={active.code}
        error={state.error}
        clock={state.clock}
        onIntent={(intent) => active.session.sendIntent(intent)}
        onDismissError={() => active.session.dismissError()}
        onEndGame={active.host ? () => active.host?.backToLobby() : undefined}
      />
    );
  }

  return (
    <>
      <LangToggle />
      {renderScreen()}
    </>
  );
}
