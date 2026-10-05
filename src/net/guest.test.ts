import { describe, it, expect, vi } from 'vitest';
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

  it('shows a refused move as an error until it is dismissed', async () => {
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

  it('ignores a second intent while waiting for the reply, then accepts again', async () => {
    const { host, sessions } = await table(['Ana', 'Bo']);
    host.start();
    await flush();
    const mover = sessions[host.game!.state.turn.player];
    expect(mover.current.awaiting).toBe(false);
    mover.sendIntent({ type: 'endPhase' });
    mover.sendIntent({ type: 'endPhase' });
    expect(mover.current.awaiting).toBe(true);
    await flush();
    expect(host.game!.state.turn.phase).toBe('buy');
    expect(mover.current.awaiting).toBe(false);
    mover.sendIntent({ type: 'endPhase' });
    await flush();
    expect(host.game!.state.turn.player).not.toBe(sessions.indexOf(mover));
  });

  it('stops awaiting when the host refuses the move', async () => {
    const { host, sessions } = await table(['Ana', 'Bo']);
    host.start();
    await flush();
    const waiting = sessions[1 - host.game!.state.turn.player];
    waiting.sendIntent({ type: 'endPhase' });
    expect(waiting.current.awaiting).toBe(true);
    await flush();
    expect(waiting.current).toMatchObject({ awaiting: false, error: 'It is not your turn' });
    waiting.sendIntent({ type: 'endPhase' });
    expect(waiting.current.error).toBeNull();
  });

  it('sends setColor to the host', async () => {
    const [hostEnd, guestEnd] = createMemoryPair();
    const sent: unknown[] = [];
    hostEnd.onMessage((m) => sent.push(m));
    const guest = new GuestSession(guestEnd, 'Ana', memoryTokenStore());
    hostEnd.send({ type: 'welcome', playerId: 'p0', token: 't' });
    await flush();
    guest.setColor('teal');
    await flush();
    expect(sent).toContainEqual({ type: 'setColor', color: 'teal' });
  });

  it('turns the clock into a local deadline', async () => {
    const [hostEnd, guestEnd] = createMemoryPair();
    const guest = new GuestSession(guestEnd, 'Ana', memoryTokenStore());
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    hostEnd.send({ type: 'welcome', playerId: 'p0', token: 't' });
    hostEnd.send({ type: 'view', view: { you: 0 }, clock: { kind: 'turn', remainingMs: 30_000, totalMs: 45_000 } });
    await flush();
    expect(guest.current.clock).toEqual({ kind: 'turn', totalMs: 45_000, deadline: 1_030_000 });
    hostEnd.send({ type: 'view', view: { you: 0 }, clock: null });
    await flush();
    expect(guest.current.clock).toBeNull();
    now.mockRestore();
  });
});
