import { describe, it, expect } from 'vitest';
import type { GameResult } from '../engine/types';
import { HostSession } from './host';
import { flush } from './memory';
import { RESPONSE_MS } from './turnClock';
import { fakeScheduler, join, seededHostOptions } from './testing';

async function timedGame(seconds: number | null) {
  const sched = fakeScheduler();
  const host = new HostSession({ ...seededHostOptions(), scheduler: sched });
  const ana = await join(host, 'Ana', { local: true });
  const bo = await join(host, 'Bo');
  expect(host.setTurnTimer(seconds)).toEqual({ ok: true });
  expect(host.start()).toEqual({ ok: true });
  await flush();
  return { sched, host, ana, bo };
}

/** Lets the clock run out until `player` (0 = Ana the host, 1 = Bo) is up. */
async function untilTurnOf(player: number, ctx: Awaited<ReturnType<typeof timedGame>>) {
  if (ctx.host.game!.state.turn.player !== player) ctx.sched.advance(45_000);
  await flush();
  expect(ctx.host.game!.state.turn.player).toBe(player);
}

describe('HostSession turn timer edge cases', () => {
  it('turns the timer off again with setTurnTimer(null)', async () => {
    const sched = fakeScheduler();
    const host = new HostSession({ ...seededHostOptions(), scheduler: sched });
    const ana = await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    expect(host.setTurnTimer(45)).toEqual({ ok: true });
    expect(host.setTurnTimer(null)).toEqual({ ok: true });
    await flush();
    expect(bo.last('lobby')!.lobby.turnTimer).toBeNull();
    host.start();
    await flush();
    expect(ana.last('view')!.clock).toBeNull();
    expect(bo.last('view')!.clock).toBeNull();
    const first = host.game!.state.turn.player;
    sched.advance(10 * 60_000);
    expect(host.game!.state.turn.player).toBe(first);
  });

  it('broadcasts the timer setting to every guest', async () => {
    const host = new HostSession(seededHostOptions());
    await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    const cy = await join(host, 'Cy');
    host.setTurnTimer(120);
    await flush();
    expect(bo.last('lobby')!.lobby.turnTimer).toBe(120);
    expect(cy.last('lobby')!.lobby.turnTimer).toBe(120);
  });

  it('accepts every listed option and rejects zero and negatives', () => {
    const host = new HostSession(seededHostOptions());
    for (const s of [45, 60, 90, 120]) expect(host.setTurnTimer(s)).toEqual({ ok: true });
    expect(host.setTurnTimer(0)).toEqual({ ok: false, reason: 'Invalid timer' });
    expect(host.setTurnTimer(-45)).toEqual({ ok: false, reason: 'Invalid timer' });
    expect(host.lobby.turnTimer).toBe(120);
  });

  it('play again starts a fresh clock', async () => {
    const ctx = await timedGame(45);
    const { sched, host, ana } = ctx;
    sched.advance(20_000);
    const result: GameResult = { winners: ['p0'], scores: [] };
    host.game!.state.result = result;
    host.gameChanged();
    await flush();
    expect(ana.last('view')!.clock).toBeNull();
    sched.advance(100_000); // a finished game has no running clock
    expect(host.playAgain()).toEqual({ ok: true });
    await flush();
    expect(ana.last('view')!.clock).toEqual({ kind: 'turn', remainingMs: 45_000, totalMs: 45_000 });
    const first = host.game!.state.turn.player;
    sched.advance(45_000 - 1);
    expect(host.game!.state.turn.player).toBe(first);
    sched.advance(1);
    expect(host.game!.state.turn.player).toBe(1 - first);
  });

  it('still ends the turn of a player who went offline', async () => {
    const ctx = await timedGame(45);
    await untilTurnOf(1, ctx);
    ctx.bo.close();
    await flush();
    expect(ctx.host.lobby.players[1].online).toBe(false);
    ctx.sched.advance(45_000);
    await flush();
    expect(ctx.host.game!.state.turn.player).toBe(0);
    expect(ctx.host.game!.state.log.some((e) => e.text === 'timeout: turn ended' && e.player === 1)).toBe(true);
    expect(ctx.ana.last('view')!.clock).toMatchObject({ kind: 'turn', remainingMs: 45_000 });
  });

  it('answers at random for the host when the host owns the timed-out prompt', async () => {
    const ctx = await timedGame(45);
    await untilTurnOf(1, ctx);
    const s = ctx.host.game!.state;
    s.players[1].hand = ['militia', 'copper', 'copper', 'copper', 'copper'];
    s.players[0].hand = ['copper', 'copper', 'estate', 'estate', 'silver'];
    ctx.bo.send({ type: 'intent', intent: { type: 'playAction', handIndex: 0 } });
    await flush();
    expect(s.pending?.player).toBe(0);
    expect(ctx.ana.last('view')!.clock).toEqual({ kind: 'response', remainingMs: RESPONSE_MS, totalMs: RESPONSE_MS });
    ctx.sched.advance(RESPONSE_MS);
    await flush();
    expect(s.pending).toBeNull();
    expect(s.players[0].hand).toHaveLength(3);
    expect(s.log.some((e) => e.text === 'timeout: random answer' && e.player === 0)).toBe(true);
    expect(s.turn.player).toBe(1);
    expect(ctx.bo.last('view')!.clock).toMatchObject({ kind: 'turn', remainingMs: 45_000 });
  });

  it('stops the clock once the game is over', async () => {
    const { sched, host } = await timedGame(45);
    const first = host.game!.state.turn.player;
    host.game!.state.result = { winners: ['p0'], scores: [] };
    host.gameChanged();
    sched.advance(10 * 60_000);
    expect(host.game!.state.turn.player).toBe(first);
  });
});

describe('HostSession colors edge cases', () => {
  it('gives four players four distinct colors', async () => {
    const host = new HostSession(seededHostOptions());
    await join(host, 'Ana', { local: true });
    await join(host, 'Bo');
    await join(host, 'Cy');
    await join(host, 'Di');
    const colors = host.lobby.players.map((p) => p.color);
    expect(colors).toHaveLength(4);
    expect(new Set(colors).size).toBe(4);
  });

  it('treats picking your own color as a no-op, not an error', async () => {
    const host = new HostSession(seededHostOptions());
    await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    const before = host.lobby.players.map((p) => p.color);
    bo.send({ type: 'setColor', color: before[1] });
    await flush();
    expect(bo.last('error')).toBeUndefined();
    expect(host.lobby.players.map((p) => p.color)).toEqual(before);
  });

  it('ignores an unknown color from a raw message', async () => {
    const host = new HostSession(seededHostOptions());
    const ana = await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    const lobbies = ana.messages.filter((m) => m.type === 'lobby').length;
    bo.send({ type: 'setColor', color: 'chartreuse' });
    bo.send({ type: 'setColor', color: 42 });
    bo.send({ type: 'setColor' });
    await flush();
    expect(host.lobby.players.map((p) => p.color)).toEqual(['blue', 'red']);
    expect(ana.messages.filter((m) => m.type === 'lobby').length).toBe(lobbies);
    expect(bo.last('error')).toBeUndefined();
    expect(bo.closed).toBe(false);
  });

  it('refuses a color change during a game', async () => {
    const host = new HostSession(seededHostOptions());
    await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    host.start();
    bo.send({ type: 'setColor', color: 'green' });
    await flush();
    expect(bo.last('error')).toEqual({ type: 'error', reason: 'Game in progress' });
    expect(host.lobby.players[1].color).toBe('red');
  });

  it('lets a new joiner take a color that someone freed by leaving', async () => {
    const host = new HostSession(seededHostOptions());
    await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    bo.send({ type: 'setColor', color: 'green' });
    await flush();
    bo.close();
    await flush();
    const cy = await join(host, 'Cy');
    cy.send({ type: 'setColor', color: 'green' });
    await flush();
    expect(cy.last('error')).toBeUndefined();
    expect(host.lobby.players.find((p) => p.name === 'Cy')!.color).toBe('green');
  });

  it('ignores setColor before hello', async () => {
    const host = new HostSession(seededHostOptions());
    await join(host, 'Ana', { local: true });
    const { connectClient } = await import('./testing');
    const stranger = connectClient(host);
    stranger.send({ type: 'setColor', color: 'green' });
    await flush();
    expect(host.lobby.players).toHaveLength(1);
    expect(stranger.messages).toEqual([]);
  });
});
