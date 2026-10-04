import { describe, it, expect } from 'vitest';
import { botMove } from '../sim/bigMoney';
import { GuestSession, memoryTokenStore, type TokenStore } from './guest';
import { HostSession } from './host';
import { createMemoryPair, flush } from './memory';
import { seededHostOptions } from './testing';
import type { Connection } from './transport';

function remoteGuest(host: HostSession, name: string, tokens: TokenStore = memoryTokenStore()) {
  const [hostEnd, guestEnd]: [Connection, Connection] = createMemoryPair();
  host.accept(hostEnd);
  return { session: new GuestSession(guestEnd, name, tokens), hostEnd };
}

async function table(names: string[]) {
  const host = new HostSession(seededHostOptions());
  const sessions = [new GuestSession(host.connectLocal(), names[0], memoryTokenStore())];
  for (const name of names.slice(1)) sessions.push(remoteGuest(host, name).session);
  await flush();
  return { host, sessions };
}

describe('GuestSession', () => {
  it('joins, stores its token and tracks the lobby', async () => {
    const host = new HostSession(seededHostOptions());
    new GuestSession(host.connectLocal(), 'Ana', memoryTokenStore());
    const tokens = memoryTokenStore();
    const { session } = remoteGuest(host, 'Bo', tokens);
    expect(session.current.status).toBe('connecting');
    await flush();
    expect(session.current).toMatchObject({ status: 'joined', playerId: 'p1', error: null });
    expect(tokens.get()).toBe('token-1');
    expect(session.current.lobby!.players.map((p) => p.name)).toEqual(['Ana', 'Bo']);
  });

  it('notifies subscribers until they unsubscribe', async () => {
    const host = new HostSession(seededHostOptions());
    const session = new GuestSession(host.connectLocal(), 'Ana', memoryTokenStore());
    const seen: string[] = [];
    const unsubscribe = session.subscribe((s) => seen.push(s.status));
    await flush();
    expect(seen).toContain('joined');
    unsubscribe();
    const count = seen.length;
    host.randomizeKingdom();
    await flush();
    expect(seen).toHaveLength(count);
  });

  it('is rejected when a game is already in progress', async () => {
    const { host } = await table(['Ana', 'Bo']);
    host.start();
    const { session } = remoteGuest(host, 'Late');
    await flush();
    expect(session.current).toMatchObject({ status: 'rejected', error: 'Game in progress' });
  });

  it('rejoins its seat with a stored token after a disconnect', async () => {
    const host = new HostSession(seededHostOptions());
    new GuestSession(host.connectLocal(), 'Ana', memoryTokenStore());
    const tokens = memoryTokenStore();
    const first = remoteGuest(host, 'Bo', tokens).session;
    await flush();
    host.start();
    await flush();
    first.leave();
    await flush();

    const again = remoteGuest(host, 'Bo', tokens).session;
    await flush();
    expect(again.current).toMatchObject({ status: 'joined', playerId: 'p1' });
    expect(again.current.view!.you).toBe(1);
  });

  it('shows a refused move as an error and clears it on the next move', async () => {
    const { host, sessions } = await table(['Ana', 'Bo']);
    host.start();
    await flush();
    const waiting = sessions[1 - host.game!.state.turn.player];
    waiting.sendIntent({ type: 'endPhase' });
    await flush();
    expect(waiting.current.error).toBe('It is not your turn');
    waiting.dismissError();
    expect(waiting.current.error).toBeNull();
  });

  it('clears the view when the host goes back to the lobby', async () => {
    const { host, sessions } = await table(['Ana', 'Bo']);
    host.start();
    await flush();
    expect(sessions[1].current.view).not.toBeNull();
    host.backToLobby();
    await flush();
    expect(sessions[1].current.view).toBeNull();
    expect(sessions[1].current.lobby!.inGame).toBe(false);
  });

  it('reports when the host goes away', async () => {
    const host = new HostSession(seededHostOptions());
    new GuestSession(host.connectLocal(), 'Ana', memoryTokenStore());
    const { session, hostEnd } = remoteGuest(host, 'Bo');
    await flush();
    hostEnd.close();
    expect(session.current.status).toBe('disconnected');
  });

  it('plays a complete game through guest sessions', async () => {
    const { host, sessions } = await table(['Ana', 'Bo']);
    expect(host.start()).toEqual({ ok: true });
    await flush();
    const byId = new Map(sessions.map((s) => [s.current.playerId!, s]));
    const game = host.game!;
    for (let step = 0; step < 5000 && !game.state.result; step++) {
      const { playerId, intent } = botMove(game);
      const session = byId.get(playerId)!;
      session.sendIntent(intent);
      await flush();
      expect(session.current.error, `step ${step}`).toBeNull();
    }
    expect(game.state.result).not.toBeNull();
    for (const s of sessions) expect(s.current.view!.result!.winners).toEqual(game.state.result!.winners);
  });
});
