import { describe, it, expect } from 'vitest';
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

describe('HostSession turn timer', () => {
  it('validates and broadcasts the timer setting, and locks it in game', async () => {
    const host = new HostSession(seededHostOptions());
    const ana = await join(host, 'Ana', { local: true });
    expect(host.lobby.turnTimer).toBeNull();
    expect(host.setTurnTimer(37)).toEqual({ ok: false, reason: 'Invalid timer' });
    expect(host.setTurnTimer(60)).toEqual({ ok: true });
    await flush();
    expect(ana.last('lobby')!.lobby.turnTimer).toBe(60);
    await join(host, 'Bo');
    host.start();
    expect(host.setTurnTimer(90)).toEqual({ ok: false, reason: 'Game in progress' });
  });

  it('sends no clock when the timer is off', async () => {
    const { ana } = await timedGame(null);
    expect(ana.last('view')!.clock).toBeNull();
  });

  it('sends the turn clock with each view', async () => {
    const { sched, ana } = await timedGame(45);
    expect(ana.last('view')!.clock).toEqual({ kind: 'turn', remainingMs: 45_000, totalMs: 45_000 });
    sched.advance(1_000);
    expect(ana.last('view')!.clock!.remainingMs).toBe(45_000); // views only go out on changes
  });

  it('ends the turn when time runs out and logs it', async () => {
    const { sched, host, bo } = await timedGame(45);
    const first = host.game!.state.turn.player;
    sched.advance(45_000);
    await flush();
    expect(host.game!.state.turn.player).toBe(1 - first);
    expect(host.game!.state.log.some((e) => e.text === 'timeout: turn ended' && e.player === first)).toBe(true);
    expect(bo.last('view')!.clock).toMatchObject({ kind: 'turn', remainingMs: 45_000 });
  });

  it('answers an attack at random after 30 s, then resumes the turn clock', async () => {
    const { sched, host } = await timedGame(45);
    const s = host.game!.state;
    const cur = s.turn.player;
    const other = 1 - cur;
    s.players[cur].hand = ['militia', 'copper', 'copper', 'copper', 'copper'];
    s.players[other].hand = ['copper', 'copper', 'estate', 'estate', 'silver'];
    sched.advance(5_000);
    const curClient = cur === 0 ? 'p0' : 'p1';
    expect(host.game!.apply(curClient, { type: 'playAction', handIndex: 0 }).ok).toBe(true);
    host.gameChanged(); // applied straight to the engine above, so tell the host
    await flush();
    sched.advance(RESPONSE_MS);
    await flush();
    expect(s.pending).toBeNull();
    expect(s.players[other].hand).toHaveLength(3);
    expect(s.log.some((e) => e.text === 'timeout: random answer' && e.player === other)).toBe(true);
    expect(s.turn.player).toBe(cur);
    sched.advance(40_000 - 1);
    expect(s.turn.player).toBe(cur);
    sched.advance(1);
    expect(s.turn.player).toBe(other);
  });

  it('stops the clock when going back to the lobby', async () => {
    const { sched, host } = await timedGame(45);
    host.backToLobby();
    sched.advance(100_000);
    expect(host.game).toBeNull();
  });
});
