export interface Scheduler {
  now(): number;
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const realScheduler: Scheduler = {
  now: () => Date.now(),
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export type ClockKind = 'turn' | 'response';

export interface ClockInfo {
  kind: ClockKind;
  remainingMs: number;
  totalMs: number;
}

/** Time to answer a prompt from someone else's card, such as an attack. */
export const RESPONSE_MS = 30_000;

export interface ClockInput {
  /** The engine's turn object: a new object means a new turn. */
  turn: object;
  currentPlayer: number;
  /** The engine's pending prompt: a new object means a new prompt. */
  pending: { player: number } | null;
  over: boolean;
}

/**
 * The host's two timers. The turn clock runs while the current player acts,
 * including their own prompts. A prompt for anyone else pauses it and starts
 * a 30 s response clock; answering resumes the turn clock where it stopped.
 */
export class TurnClock {
  private turn: object | null = null;
  private turnLeft = 0;
  private runningSince: number | null = null;
  private response: { prompt: object; deadline: number } | null = null;
  private timer: unknown = null;

  constructor(
    private readonly turnMs: number,
    private readonly scheduler: Scheduler,
    private readonly onExpire: (kind: ClockKind) => void,
  ) {}

  sync({ turn, currentPlayer, pending, over }: ClockInput): void {
    if (over) {
      this.stop();
      return;
    }
    if (turn !== this.turn) {
      this.stop();
      this.turn = turn;
      this.turnLeft = this.turnMs;
    }
    if (pending && pending.player !== currentPlayer) {
      if (this.response?.prompt === pending) return;
      this.pauseTurn();
      this.clearTimer();
      this.response = { prompt: pending, deadline: this.scheduler.now() + RESPONSE_MS };
      this.timer = this.scheduler.set(() => this.expire('response'), RESPONSE_MS);
      return;
    }
    if (this.response) {
      this.response = null;
      this.clearTimer();
    }
    if (this.runningSince === null) {
      this.runningSince = this.scheduler.now();
      this.timer = this.scheduler.set(() => this.expire('turn'), this.turnLeft);
    }
  }

  info(): ClockInfo | null {
    const now = this.scheduler.now();
    if (this.response) return { kind: 'response', remainingMs: Math.max(0, this.response.deadline - now), totalMs: RESPONSE_MS };
    if (this.runningSince !== null) {
      return { kind: 'turn', remainingMs: Math.max(0, this.turnLeft - (now - this.runningSince)), totalMs: this.turnMs };
    }
    return null;
  }

  stop(): void {
    this.clearTimer();
    this.turn = null;
    this.runningSince = null;
    this.response = null;
  }

  private pauseTurn(): void {
    if (this.runningSince === null) return;
    this.turnLeft = Math.max(0, this.turnLeft - (this.scheduler.now() - this.runningSince));
    this.runningSince = null;
  }

  private clearTimer(): void {
    if (this.timer !== null) this.scheduler.clear(this.timer);
    this.timer = null;
  }

  private expire(kind: ClockKind): void {
    this.timer = null;
    if (kind === 'turn') this.runningSince = null;
    else this.response = null;
    this.onExpire(kind);
  }
}
