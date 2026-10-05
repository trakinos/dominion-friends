import { describe, it, expect } from 'vitest';
import { RESPONSE_MS, TurnClock, type ClockKind } from './turnClock';
import { fakeScheduler } from './testing';

function setup(turnMs = 45_000) {
  const sched = fakeScheduler();
  const expired: ClockKind[] = [];
  const clock = new TurnClock(turnMs, sched, (k) => expired.push(k));
  return { sched, expired, clock };
}

describe('TurnClock', () => {
  it('runs the turn clock and expires it', () => {
    const { sched, expired, clock } = setup();
    const turn = {};
    clock.sync({ turn, currentPlayer: 0, pending: null, over: false });
    sched.advance(10_000);
    expect(clock.info()).toEqual({ kind: 'turn', remainingMs: 35_000, totalMs: 45_000 });
    sched.advance(35_000);
    expect(expired).toEqual(['turn']);
  });

  it('keeps running during the current player\'s own prompts', () => {
    const { sched, clock } = setup();
    const turn = {};
    clock.sync({ turn, currentPlayer: 0, pending: null, over: false });
    sched.advance(5_000);
    clock.sync({ turn, currentPlayer: 0, pending: { player: 0 }, over: false });
    sched.advance(5_000);
    expect(clock.info()).toMatchObject({ kind: 'turn', remainingMs: 35_000 });
  });

  it('pauses the turn for an attack response and resumes with the time left', () => {
    const { sched, expired, clock } = setup();
    const turn = {};
    clock.sync({ turn, currentPlayer: 0, pending: null, over: false });
    sched.advance(10_000);
    const attack = { player: 1 };
    clock.sync({ turn, currentPlayer: 0, pending: attack, over: false });
    expect(clock.info()).toEqual({ kind: 'response', remainingMs: RESPONSE_MS, totalMs: RESPONSE_MS });
    sched.advance(20_000);
    clock.sync({ turn, currentPlayer: 0, pending: attack, over: false }); // a repeat broadcast changes nothing
    expect(clock.info()).toMatchObject({ kind: 'response', remainingMs: 10_000 });
    clock.sync({ turn, currentPlayer: 0, pending: null, over: false });
    expect(clock.info()).toMatchObject({ kind: 'turn', remainingMs: 35_000 });
    expect(expired).toEqual([]);
  });

  it('expires a response after 30 s and restarts it for each new prompt', () => {
    const { sched, expired, clock } = setup();
    const turn = {};
    clock.sync({ turn, currentPlayer: 0, pending: { player: 1 }, over: false });
    sched.advance(RESPONSE_MS - 1);
    clock.sync({ turn, currentPlayer: 0, pending: { player: 2 }, over: false });
    sched.advance(RESPONSE_MS - 1);
    expect(expired).toEqual([]);
    sched.advance(1);
    expect(expired).toEqual(['response']);
  });

  it('starts fresh on a new turn and stops when the game is over', () => {
    const { sched, expired, clock } = setup();
    clock.sync({ turn: {}, currentPlayer: 0, pending: null, over: false });
    sched.advance(40_000);
    clock.sync({ turn: {}, currentPlayer: 1, pending: null, over: false });
    expect(clock.info()).toMatchObject({ remainingMs: 45_000 });
    clock.sync({ turn: {}, currentPlayer: 1, pending: null, over: true });
    expect(clock.info()).toBeNull();
    sched.advance(100_000);
    expect(expired).toEqual([]);
  });
});
