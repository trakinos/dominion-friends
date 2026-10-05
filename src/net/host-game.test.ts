import { describe, it, expect, vi } from 'vitest';
import { HostSession } from './host';
import { flush } from './memory';
import { join, seededHostOptions, type TestClient } from './testing';

async function lobbyOf(names: string[]): Promise<{ host: HostSession; clients: TestClient[] }> {
  const host = new HostSession(seededHostOptions());
  const clients = [await join(host, names[0], { local: true })];
  for (const name of names.slice(1)) clients.push(await join(host, name));
  return { host, clients };
}

async function started(names: string[]) {
  const ctx = await lobbyOf(names);
  expect(ctx.host.start()).toEqual({ ok: true });
  await flush();
  return ctx;
}

function turnClient(host: HostSession, clients: TestClient[]): TestClient {
  return clients[host.game!.state.turn.player];
}

describe('HostSession game flow', () => {
  it('needs two players to start', async () => {
    const { host } = await lobbyOf(['Ana']);
    expect(host.start()).toEqual({ ok: false, reason: 'Need at least 2 players' });
  });

  it('starts the game and sends each player their own view', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    const [ana, bo] = clients;
    expect(ana.last('lobby')!.lobby.inGame).toBe(true);
    expect(bo.last('lobby')!.lobby.inGame).toBe(true);
    expect(ana.last('view')!.view.you).toBe(0);
    expect(bo.last('view')!.view.you).toBe(1);
    expect(ana.last('view')!.view.hand).toEqual(host.game!.state.players[0].hand);
    expect(bo.last('view')!.view.players[0]).not.toHaveProperty('hand');
    expect(host.start()).toEqual({ ok: false, reason: 'Game already started' });
  });

  it('applies intents and broadcasts new views', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    turnClient(host, clients).send({ type: 'intent', intent: { type: 'endPhase' } });
    await flush();
    for (const c of clients) expect(c.last('view')!.view.turn.phase).toBe('buy');
  });

  it('sends refused moves back only to the sender', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    const waiting = clients[1 - host.game!.state.turn.player];
    waiting.send({ type: 'intent', intent: { type: 'endPhase' } });
    await flush();
    expect(waiting.last('error')).toEqual({ type: 'error', reason: 'It is not your turn' });
    expect(turnClient(host, clients).last('error')).toBeUndefined();
  });

  it('rejects intents before the game starts', async () => {
    const { clients } = await lobbyOf(['Ana', 'Bo']);
    clients[1].send({ type: 'intent', intent: { type: 'endPhase' } });
    await flush();
    expect(clients[1].last('error')).toEqual({ type: 'error', reason: 'No game in progress' });
  });

  it('refuses new players once the game has started', async () => {
    const { host } = await started(['Ana', 'Bo']);
    const late = await join(host, 'Late');
    expect(late.last('error')).toEqual({ type: 'error', reason: 'Game in progress' });
    expect(host.lobby.players).toHaveLength(2);
  });

  it("keeps a disconnected player's seat and lets them rejoin with their token", async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    const [ana, bo] = clients;
    const token = bo.last('welcome')!.token;
    bo.close();
    await flush();
    expect(ana.last('lobby')!.lobby.players[1]).toMatchObject({ id: 'p1', online: false });

    const back = await join(host, 'Bo', { token });
    expect(back.last('welcome')).toMatchObject({ playerId: 'p1', token });
    expect(back.last('view')!.view.you).toBe(1);
    expect(ana.last('lobby')!.lobby.players[1].online).toBe(true);
  });

  it('replaces an older connection that uses the same token', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    const bo = clients[1];
    const second = await join(host, 'Bo', { token: bo.last('welcome')!.token });
    expect(bo.closed).toBe(true);
    expect(second.last('welcome')).toMatchObject({ playerId: 'p1' });
    expect(host.lobby.players[1].online).toBe(true);
  });

  it('reports engine crashes as errors instead of throwing', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    vi.spyOn(host.game!, 'apply').mockImplementation(() => {
      throw new Error('boom');
    });
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    clients[0].send({ type: 'intent', intent: { type: 'endPhase' } });
    await flush();
    expect(clients[0].last('error')).toEqual({ type: 'error', reason: 'Something went wrong' });
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });

  it('plays again with the same kingdom only after the game ends', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    expect(host.playAgain()).toEqual({ ok: false, reason: 'The game is not over' });
    const kingdom = host.game!.state.kingdom;
    host.game!.state.supply.province = 0;
    turnClient(host, clients).send({ type: 'intent', intent: { type: 'endPhase' } });
    await flush();
    turnClient(host, clients).send({ type: 'intent', intent: { type: 'endPhase' } });
    await flush();
    expect(clients[0].last('view')!.view.result).not.toBeNull();

    expect(host.playAgain()).toEqual({ ok: true });
    await flush();
    expect(host.game!.state.result).toBeNull();
    expect(host.game!.state.kingdom).toEqual(kingdom);
    expect(clients[1].last('view')!.view.result).toBeNull();
  });

  it('goes back to the lobby and drops offline players', async () => {
    const { host, clients } = await started(['Ana', 'Bo', 'Cy']);
    clients[2].close();
    await flush();
    host.backToLobby();
    await flush();
    const lobby = clients[0].last('lobby')!.lobby;
    expect(lobby.inGame).toBe(false);
    expect(lobby.players.map((p) => p.name)).toEqual(['Ana', 'Bo']);
    expect(host.game).toBeNull();
  });

  it('keeps a color on rejoin and locks colors during a game', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    const bo = clients[1];
    bo.send({ type: 'setColor', color: 'pink' });
    await flush();
    expect(bo.last('error')).toEqual({ type: 'error', reason: 'Game in progress' });
    const token = bo.last('welcome')!.token;
    bo.close();
    await flush();
    await join(host, 'Bo', { token });
    expect(host.lobby.players[1].color).toBe('red');
  });
});
