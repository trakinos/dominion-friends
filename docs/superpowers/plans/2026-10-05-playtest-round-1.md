# Playtest Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first playtest's feedback: unique player colors, a colored turn board in the play area, an optional turn timer with random auto-moves, an action-phase click guard, and an animated VP tally on the end screen.

**Architecture:** The rules engine stays pure. It gains only `Game.note()` and two helpers that build random legal moves (`randomAnswer`, `answerAtRandom`, `finishTurn`). The host's browser owns colors, the timer setting and a `TurnClock` (injectable scheduler). At expiry it applies the auto-moves through the normal `Game.apply` path and sends each client the time left, which clients count down locally. The UI splits today's `TurnBar` into a display-only `TurnBoard` (in the play area) and `TurnActions` (in your dock), tints both with CSS custom properties, and adds a pure `tallySteps()` that drives the end-screen animation.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, PeerJS (unchanged).

**Spec:** `docs/superpowers/specs/2026-10-05-playtest-round-1-design.md`

## Global Constraints

- Every new user-facing string goes in **both** `src/i18n/en.ts` and `src/i18n/pt.ts` (`ui`, `log` or `reasons`). `src/i18n/coverage.test.ts` must keep passing.
- Portuguese copy is gender-neutral (for example "Você recebeu um convite", not "convidado").
- Timer options: Off (default), 45, 60, 90, 120 seconds. Attack-response clock: 30 seconds. Last-10-seconds warning.
- Colors: exactly 8 — blue, red, teal, amber, green, purple, pink, slate — unique per room, first free one assigned on join, kept on rejoin, changeable only in the lobby.
- Auto-moves never play or buy cards: they answer prompts at random and send `endPhase`.
- Respect `prefers-reduced-motion` for the tally.
- Commands: `npx vitest run <file>` for one file, `npm test` for all, `npx tsc --noEmit` for types. Match the surrounding code style (2-space indent, single quotes, no semicolon-free lines).
- Commit after each task with a `feat(...)`/`test(...)` message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/engine/randomAnswer.ts` | create | `randomAnswer(prompt, rng)`: a random legal answer for any prompt |
| `src/engine/timeout.ts` | create | `answerAtRandom(game, rng)`, `finishTurn(game, rng)` |
| `src/engine/game.ts` | modify | add public `note(player, text)` |
| `src/net/turnClock.ts` | create | `TurnClock`, `Scheduler`, `realScheduler`, `ClockInfo`, `RESPONSE_MS` |
| `src/net/testing.ts` | modify | add `fakeScheduler()` |
| `src/theme/playerColors.ts` | create | palette, `PlayerColorId`, `isPlayerColor`, `colorHex` |
| `src/net/protocol.ts` | modify | `color`, `turnTimer`, `setColor` message, `clock` on views |
| `src/net/host.ts` | modify | color assignment, `setTurnTimer`, clock wiring, expiry auto-moves |
| `src/net/guest.ts` | modify | `setColor()`, local `clock` deadline |
| `src/ui/playerColor.ts` | create | `playerColor(lobby, playerId)` |
| `src/ui/components/Avatar.tsx` | modify | takes a `color` instead of a seat |
| `src/ui/components/ColorPicker.tsx` | create | swatches for your lobby row |
| `src/ui/components/TimerBar.tsx` | create | live countdown bar |
| `src/ui/components/TurnBoard.tsx` | create (from `TurnBar.tsx`) | pill, phases, info, counters, timer |
| `src/ui/components/TurnActions.tsx` | create (from `TurnBar.tsx`) | Play all Treasures, End Actions/End turn |
| `src/ui/components/TurnBar.tsx` | delete | replaced by the two above |
| `src/ui/components/ConfirmDialog.tsx` | modify | `tone` prop |
| `src/ui/moves.ts` | modify | `canStillPlayAction(view)` |
| `src/ui/tally.ts` | create | `tallySteps(result)` |
| `src/ui/screens/Board.tsx`, `Lobby.tsx`, `EndScreen.tsx`, `App.tsx` | modify | wiring |
| `src/ui/components/Opponents.tsx`, `PromptPanel.tsx` | modify | colors, response clock |
| `src/styles.css` | modify | tints, layout, timer, tally |
| `docs/ROADMAP.md` | modify | sounds, VP art, playtest tick |

---

### Task 1: Random answers and turn auto-finish (engine)

**Files:**
- Create: `src/engine/randomAnswer.ts`, `src/engine/timeout.ts`
- Modify: `src/engine/game.ts` (add `note` after the `log` method, ~line 58)
- Test: `src/engine/randomAnswer.test.ts`, `src/engine/timeout.test.ts`

**Interfaces:**
- Produces:
  - `randomAnswer(prompt: Prompt, rng: RngState): PromptAnswer`
  - `answerAtRandom(game: Game, rng: RngState): boolean`: answers the pending prompt as its owner; `false` if nothing is pending.
  - `finishTurn(game: Game, rng: RngState): void`: answers prompts at random and ends phases until the turn passes or the game ends.
  - `Game.note(player: number | null, text: string): void`: appends a log entry.

- [ ] **Step 1: Write the failing tests**

`src/engine/randomAnswer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { KINGDOM_IDS } from '../cards/registry';
import { botMove } from '../sim/bigMoney';
import { Game } from './game';
import { validateAnswer } from './prompts';
import { randomAnswer } from './randomAnswer';
import { createRng, shuffle } from './rng';
import type { Prompt } from './types';

const base = { id: 'x', player: 0, message: 'm' };

describe('randomAnswer', () => {
  it('answers each prompt kind legally', () => {
    const rng = createRng(3);
    const prompts: Prompt[] = [
      { ...base, kind: 'chooseCards', cards: ['copper', 'estate', 'silver'], selectable: [0, 2], min: 0, max: 2 },
      { ...base, kind: 'chooseCards', cards: ['copper', 'estate'], selectable: [0, 1], min: 2, max: 2 },
      { ...base, kind: 'chooseSupply', piles: ['silver', 'village'], optional: true },
      { ...base, kind: 'chooseSupply', piles: ['silver'], optional: false },
      { ...base, kind: 'chooseOption', options: ['a', 'b', 'c'], optionIds: ['a', 'b', 'c'] },
      { ...base, kind: 'orderCards', cards: ['copper', 'gold', 'estate'] },
    ] as Prompt[];
    for (let i = 0; i < 200; i++) {
      for (const p of prompts) expect(validateAnswer(p, randomAnswer(p, rng))).toBeNull();
    }
  });

  it('keeps whole seeded games legal when every prompt is answered at random', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const game = Game.create({
        players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
        kingdom: shuffle(createRng(seed), KINGDOM_IDS).slice(0, 10),
        seed,
      });
      const rng = createRng(seed * 31);
      for (let step = 0; step < 4000 && !game.state.result; step++) {
        const p = game.state.pending;
        if (p) {
          const answer = randomAnswer(p, rng);
          expect(validateAnswer(p, answer), `seed ${seed} prompt ${p.id}`).toBeNull();
          expect(game.apply(game.state.players[p.player].id, { type: 'answerPrompt', answer }).ok).toBe(true);
        } else {
          const m = botMove(game);
          expect(game.apply(m.playerId, m.intent).ok).toBe(true);
        }
      }
    }
  });
});
```

`src/engine/timeout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { KINGDOM_IDS } from '../cards/registry';
import { botMove } from '../sim/bigMoney';
import { Game } from './game';
import { createRng, nextInt, shuffle } from './rng';
import { answerAtRandom, finishTurn } from './timeout';
import { newState, setZones } from './testkit';

describe('answerAtRandom', () => {
  it('returns false when nothing is pending', () => {
    expect(answerAtRandom(new Game(newState()), createRng(1))).toBe(false);
  });

  it('answers an attack response for the attacked player', () => {
    const state = newState();
    setZones(state, 0, { hand: ['militia'] });
    setZones(state, 1, { hand: ['copper', 'copper', 'estate', 'estate', 'silver'] });
    const game = new Game(state);
    expect(game.apply('p0', { type: 'playAction', handIndex: 0 }).ok).toBe(true);
    expect(game.state.pending?.player).toBe(1);
    expect(answerAtRandom(game, createRng(1))).toBe(true);
    expect(game.state.pending).toBeNull();
    expect(game.state.players[1].hand).toHaveLength(3);
  });
});

describe('finishTurn', () => {
  it('ends a fresh turn without playing or buying', () => {
    const game = new Game(newState());
    const handBefore = [...game.state.players[0].hand];
    finishTurn(game, createRng(1));
    expect(game.state.turn.player).toBe(1);
    expect(game.state.players[0].discard).toEqual(expect.arrayContaining(handBefore));
    expect(game.state.log.some((e) => e.text === 'buys')).toBe(false);
  });

  it('always passes the turn or ends the game, even mid-prompt', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const game = Game.create({
        players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
        kingdom: shuffle(createRng(seed), KINGDOM_IDS).slice(0, 10),
        seed,
      });
      const rng = createRng(seed);
      const warmup = nextInt(rng, 400);
      for (let i = 0; i < warmup && !game.state.result; i++) {
        const m = botMove(game);
        game.apply(m.playerId, m.intent);
      }
      if (game.state.result) continue;
      const turn = game.state.turn;
      finishTurn(game, rng);
      expect(game.state.result !== null || game.state.turn !== turn, `seed ${seed}`).toBe(true);
      expect(game.state.pending).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/engine/randomAnswer.test.ts src/engine/timeout.test.ts`
Expected: FAIL. The modules `./randomAnswer` and `./timeout` don't exist.

- [ ] **Step 3: Implement**

`src/engine/randomAnswer.ts`:

```ts
import { nextInt, shuffle, type RngState } from './rng';
import type { Prompt, PromptAnswer } from './types';

/** A uniformly random legal answer. Used when a player's clock runs out. */
export function randomAnswer(prompt: Prompt, rng: RngState): PromptAnswer {
  switch (prompt.kind) {
    case 'chooseCards': {
      const max = Math.min(prompt.max, prompt.selectable.length);
      const min = Math.min(prompt.min, max);
      const count = min + nextInt(rng, max - min + 1);
      return { kind: 'cards', indices: shuffle(rng, prompt.selectable).slice(0, count) };
    }
    case 'chooseSupply': {
      const skip = prompt.piles.length === 0 || (prompt.optional && nextInt(rng, prompt.piles.length + 1) === 0);
      return { kind: 'supply', card: skip ? null : prompt.piles[nextInt(rng, prompt.piles.length)] };
    }
    case 'chooseOption':
      return { kind: 'option', index: nextInt(rng, prompt.options.length) };
    case 'orderCards':
      return { kind: 'order', order: shuffle(rng, prompt.cards.map((_, i) => i)) };
  }
}
```

`src/engine/timeout.ts`:

```ts
import type { Game } from './game';
import { randomAnswer } from './randomAnswer';
import type { RngState } from './rng';

/** Safety net: a turn never needs anywhere near this many forced moves. */
const MAX_FORCED_MOVES = 500;

/** Answers the pending prompt at random, as the player who owns it. */
export function answerAtRandom(game: Game, rng: RngState): boolean {
  const p = game.state.pending;
  if (!p) return false;
  const owner = game.state.players[p.player].id;
  return game.apply(owner, { type: 'answerPrompt', answer: randomAnswer(p, rng) }).ok;
}

/** Ends the current turn: random answers for open prompts, then End Phase until the next player is up. Never plays or buys. */
export function finishTurn(game: Game, rng: RngState): void {
  const s = game.state;
  const turn = s.turn;
  for (let i = 0; i < MAX_FORCED_MOVES && !s.result && s.turn === turn; i++) {
    if (s.pending) answerAtRandom(game, rng);
    else game.apply(s.players[turn.player].id, { type: 'endPhase' });
  }
}
```

In `src/engine/game.ts`, add right after the private `log` method:

```ts
  /** A log line from outside the rules, such as the host's timer. */
  note(player: number | null, text: string): void {
    this.log(player, text);
  }
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/engine/randomAnswer.test.ts src/engine/timeout.test.ts`
Expected: PASS (4 + 3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/randomAnswer.ts src/engine/timeout.ts src/engine/game.ts src/engine/randomAnswer.test.ts src/engine/timeout.test.ts
git commit -m "feat(engine): random prompt answers and forced turn finish for the timer"
```

---

### Task 2: TurnClock

**Files:**
- Create: `src/net/turnClock.ts`
- Modify: `src/net/testing.ts` (append `fakeScheduler`)
- Test: `src/net/turnClock.test.ts`

**Interfaces:**
- Produces:
  - `interface Scheduler { now(): number; set(fn: () => void, ms: number): unknown; clear(handle: unknown): void }`
  - `realScheduler: Scheduler`
  - `type ClockKind = 'turn' | 'response'`
  - `interface ClockInfo { kind: ClockKind; remainingMs: number; totalMs: number }`
  - `RESPONSE_MS = 30_000`
  - `class TurnClock { constructor(turnMs: number, scheduler: Scheduler, onExpire: (kind: ClockKind) => void); sync(s: { turn: object; currentPlayer: number; pending: { player: number } | null; over: boolean }): void; info(): ClockInfo | null; stop(): void }`
  - `fakeScheduler(): Scheduler & { advance(ms: number): void }` in `src/net/testing.ts`

How `sync` works: `turn` and `pending` are compared **by object identity**. The engine creates a new `turn` object every turn (`freshTurn`) and a new prompt object every time a card asks something, so identity tells a new turn or a new prompt from a repeated broadcast.

- [ ] **Step 1: Write the failing test**

`src/net/turnClock.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/net/turnClock.test.ts`
Expected: FAIL. `./turnClock` and `fakeScheduler` don't exist.

- [ ] **Step 3: Implement**

Append to `src/net/testing.ts`:

```ts
import type { Scheduler } from './turnClock';

/** A manual clock for timer tests: time only moves when `advance` is called. */
export function fakeScheduler(): Scheduler & { advance(ms: number): void } {
  let now = 0;
  let nextId = 0;
  const tasks = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    set(fn, ms) {
      const id = ++nextId;
      tasks.set(id, { at: now + ms, fn });
      return id;
    },
    clear(handle) {
      tasks.delete(handle as number);
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...tasks.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        tasks.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
  };
}
```

(Put the `import type` line with the other imports at the top of the file.)

`src/net/turnClock.ts`:

```ts
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
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/net/turnClock.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/net/turnClock.ts src/net/turnClock.test.ts src/net/testing.ts
git commit -m "feat(net): host turn clock with paused attack-response clock"
```

---

### Task 3: Player colors in the protocol, host and guest

**Files:**
- Create: `src/theme/playerColors.ts`
- Modify: `src/net/protocol.ts`, `src/net/host.ts`, `src/net/guest.ts`, `src/i18n/en.ts`, `src/i18n/pt.ts` (reasons)
- Test: `src/theme/playerColors.test.ts`, `src/net/host.test.ts`, `src/net/protocol.test.ts`, `src/net/guest.test.ts`

**Interfaces:**
- Produces:
  - `PLAYER_COLORS: readonly { id: PlayerColorId; hex: string }[]` (8 entries, in palette order)
  - `type PlayerColorId = 'blue' | 'red' | 'teal' | 'amber' | 'green' | 'purple' | 'pink' | 'slate'`
  - `isPlayerColor(x: unknown): x is PlayerColorId`
  - `colorHex(id: PlayerColorId | undefined): string`: falls back to blue
  - `LobbyPlayer.color: PlayerColorId`
  - `GuestMessage` gains `{ type: 'setColor'; color: PlayerColorId }`
  - `GuestSession.setColor(color: PlayerColorId): void`

- [ ] **Step 1: Write the failing tests**

`src/theme/playerColors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PLAYER_COLORS, colorHex, isPlayerColor } from './playerColors';

describe('player colors', () => {
  it('has 8 distinct colors', () => {
    expect(PLAYER_COLORS.map((c) => c.id)).toEqual(['blue', 'red', 'teal', 'amber', 'green', 'purple', 'pink', 'slate']);
    expect(new Set(PLAYER_COLORS.map((c) => c.hex)).size).toBe(8);
  });

  it('recognises palette ids only', () => {
    expect(isPlayerColor('teal')).toBe(true);
    for (const x of ['Teal', 'orange', '', null, 3, '__proto__']) expect(isPlayerColor(x)).toBe(false);
  });

  it('maps ids to hex, defaulting to blue', () => {
    expect(colorHex('red')).toBe(PLAYER_COLORS[1].hex);
    expect(colorHex(undefined)).toBe(PLAYER_COLORS[0].hex);
  });
});
```

Add to `src/net/protocol.test.ts` inside `describe('parseGuestMessage', …)`:

```ts
  it('parses setColor with a palette color only', () => {
    expect(parseGuestMessage({ type: 'setColor', color: 'pink' })).toEqual({ type: 'setColor', color: 'pink' });
    expect(parseGuestMessage({ type: 'setColor', color: 'orange' })).toBeNull();
    expect(parseGuestMessage({ type: 'setColor' })).toBeNull();
  });
```

Add to `src/net/host.test.ts` inside `describe('HostSession lobby', …)`:

```ts
  it('gives each new player the first free color', async () => {
    const host = new HostSession(seededHostOptions());
    await join(host, 'Ana', { local: true });
    await join(host, 'Bo');
    expect(host.lobby.players.map((p) => p.color)).toEqual(['blue', 'red']);
  });

  it('lets a player pick a free color and refuses a taken one', async () => {
    const host = new HostSession(seededHostOptions());
    const ana = await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    bo.send({ type: 'setColor', color: 'green' });
    await flush();
    expect(ana.last('lobby')!.lobby.players[1].color).toBe('green');
    bo.send({ type: 'setColor', color: 'blue' });
    await flush();
    expect(bo.last('error')).toEqual({ type: 'error', reason: 'That color is taken' });
    expect(host.lobby.players[1].color).toBe('green');
  });

  it('frees a color when its player leaves the lobby', async () => {
    const host = new HostSession(seededHostOptions());
    await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    bo.close();
    await flush();
    await join(host, 'Cy');
    expect(host.lobby.players.map((p) => p.color)).toEqual(['blue', 'red']);
  });
```

Add to `src/net/host-game.test.ts` inside `describe('HostSession game flow', …)`:

```ts
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
```

Add to `src/net/guest.test.ts` (follow the file's existing setup for a `GuestSession` on a memory pair; if it builds one with `createMemoryPair()` and `memoryTokenStore()`, reuse that):

```ts
  it('sends setColor to the host', async () => {
    const [hostEnd, guestEnd] = createMemoryPair();
    const sent: unknown[] = [];
    hostEnd.onMessage((m) => sent.push(m));
    const guest = new GuestSession(guestEnd, 'Ana', memoryTokenStore());
    guest.setColor('teal');
    await flush();
    expect(sent).toContainEqual({ type: 'setColor', color: 'teal' });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/theme/playerColors.test.ts src/net/protocol.test.ts src/net/host.test.ts src/net/host-game.test.ts src/net/guest.test.ts`
Expected: FAIL. The palette module, the `setColor` parsing, `color` on players and `GuestSession.setColor` are missing.

- [ ] **Step 3: Implement**

`src/theme/playerColors.ts`:

```ts
export type PlayerColorId = 'blue' | 'red' | 'teal' | 'amber' | 'green' | 'purple' | 'pink' | 'slate';

/** Mid-tone colors: readable as solid fills and as a soft tint on light and dark backgrounds. */
export const PLAYER_COLORS: readonly { id: PlayerColorId; hex: string }[] = [
  { id: 'blue', hex: '#2c4ba8' },
  { id: 'red', hex: '#b8321f' },
  { id: 'teal', hex: '#17716f' },
  { id: 'amber', hex: '#c27c0e' },
  { id: 'green', hex: '#2f7a35' },
  { id: 'purple', hex: '#6b3f9f' },
  { id: 'pink', hex: '#c2407e' },
  { id: 'slate', hex: '#4a5568' },
];

export function isPlayerColor(x: unknown): x is PlayerColorId {
  return typeof x === 'string' && PLAYER_COLORS.some((c) => c.id === x);
}

export function colorHex(id: PlayerColorId | undefined): string {
  return PLAYER_COLORS.find((c) => c.id === id)?.hex ?? PLAYER_COLORS[0].hex;
}
```

`src/net/protocol.ts`:
- Add `import { isPlayerColor, type PlayerColorId } from '../theme/playerColors';`
- `LobbyPlayer` gains `color: PlayerColorId;`
- `GuestMessage` gains `| { type: 'setColor'; color: PlayerColorId }`
- In `parseGuestMessage`, before the final `return null`:

```ts
  if (raw.type === 'setColor' && isPlayerColor(raw.color)) return { type: 'setColor', color: raw.color };
```

`src/net/host.ts`:
- Import `PLAYER_COLORS, type PlayerColorId` from `'../theme/playerColors'`.
- `interface Seat` gains `color: PlayerColorId;`
- In the `lobby` getter, map players as `{ id: s.id, name: s.name, online: s.conn !== null, color: s.color }`.
- In `hello`, create the seat with `color: this.freeColor()`.
- In `accept`'s `onMessage`, after the `hello` branch:

```ts
      if (msg.type === 'setColor') {
        if (seat && seat.conn === conn) this.setColor(seat, conn, msg.color);
        return;
      }
```

- Add the methods:

```ts
  private setColor(seat: Seat, conn: Connection, color: PlayerColorId): void {
    if (this.activeGame) return void send(conn, { type: 'error', reason: 'Game in progress' });
    if (this.seats.some((s) => s !== seat && s.color === color)) return void send(conn, { type: 'error', reason: 'That color is taken' });
    seat.color = color;
    this.broadcastLobby();
  }

  private freeColor(): PlayerColorId {
    const taken = new Set(this.seats.map((s) => s.color));
    return (PLAYER_COLORS.find((c) => !taken.has(c.id)) ?? PLAYER_COLORS[0]).id;
  }
```

- `handleIntent` stays as it is. Note that `msg.type === 'intent'` is now reached only after the `setColor` branch.

`src/net/guest.ts`: import `type PlayerColorId` from `'../theme/playerColors'` and add:

```ts
  setColor(color: PlayerColorId): void {
    if (this.state.status !== 'joined') return;
    const msg: GuestMessage = { type: 'setColor', color };
    this.conn.send(msg);
  }
```

`src/i18n/en.ts` `reasons`: `"That color is taken": "That color is taken",`
`src/i18n/pt.ts` `reasons`: `"That color is taken": "Essa cor já está em uso",`

- [ ] **Step 4: Run them to see them pass, then the whole suite**

Run: `npx vitest run src/theme/playerColors.test.ts src/net/protocol.test.ts src/net/host.test.ts src/net/host-game.test.ts src/net/guest.test.ts && npx tsc --noEmit`
Expected: PASS. `tsc` will flag `Avatar` call sites only if they read `LobbyPlayer` exhaustively; they don't, so it passes.

Run: `npm test`
Expected: all pass. If an existing test compares a whole lobby player with `toEqual`, add `color` to its expectation.

- [ ] **Step 5: Commit**

```bash
git add src/theme/playerColors.ts src/theme/playerColors.test.ts src/net/protocol.ts src/net/protocol.test.ts src/net/host.ts src/net/host.test.ts src/net/host-game.test.ts src/net/guest.ts src/net/guest.test.ts src/i18n/en.ts src/i18n/pt.ts
git commit -m "feat(net): unique player colors chosen in the lobby"
```

---

### Task 4: Turn timer in the host and guest

**Files:**
- Modify: `src/net/protocol.ts`, `src/net/host.ts`, `src/net/guest.ts`, `src/i18n/en.ts`, `src/i18n/pt.ts` (log), `src/i18n/coverage.test.ts` (allowlist)
- Test: `src/net/host-timer.test.ts` (new), `src/net/protocol.test.ts`, `src/net/guest.test.ts`

**Interfaces:**
- Consumes: `TurnClock`, `Scheduler`, `realScheduler`, `ClockInfo` (Task 2); `answerAtRandom`, `finishTurn`, `Game.note` (Task 1); `fakeScheduler` (Task 2).
- Produces:
  - `TURN_TIMER_OPTIONS = [45, 60, 90, 120] as const` exported from `src/net/host.ts`
  - `HostOptions.scheduler?: Scheduler`
  - `HostSession.setTurnTimer(seconds: number | null): ApplyResult`
  - `LobbyState.turnTimer: number | null`
  - `HostMessage` view: `{ type: 'view'; view: PlayerView; clock: ClockInfo | null }`
  - `GuestState.clock: LocalClock | null`, where `interface LocalClock { kind: ClockKind; totalMs: number; deadline: number }` (`deadline` is a local `Date.now()` value), exported from `src/net/guest.ts`
  - Log texts: `'timeout: turn ended'` and `'timeout: random answer'`

- [ ] **Step 1: Write the failing tests**

`src/net/host-timer.test.ts`:

```ts
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
```

This test calls `host.gameChanged()` directly, so `gameChanged` is a **public** method on `HostSession` (see step 3).

Add to `src/net/protocol.test.ts` inside `describe('parseHostMessage', …)`, or create that `describe` block if it doesn't exist:

```ts
  it('parses a view with or without a clock', () => {
    const view = { you: 0 };
    expect(parseHostMessage({ type: 'view', view, clock: { kind: 'turn', remainingMs: 5, totalMs: 10 } })).toEqual({
      type: 'view', view, clock: { kind: 'turn', remainingMs: 5, totalMs: 10 },
    });
    expect(parseHostMessage({ type: 'view', view })).toEqual({ type: 'view', view, clock: null });
    expect(parseHostMessage({ type: 'view', view, clock: { kind: 'nope', remainingMs: 5, totalMs: 10 } })).toEqual({ type: 'view', view, clock: null });
  });
```

Add to `src/net/guest.test.ts`:

```ts
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
```

(Add `vi` to the file's `vitest` import if it's missing.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/net/host-timer.test.ts src/net/protocol.test.ts src/net/guest.test.ts`
Expected: FAIL. `setTurnTimer`, `turnTimer`, `scheduler`, `clock` and `gameChanged` are missing.

- [ ] **Step 3: Implement**

`src/net/protocol.ts`:
- `import type { ClockInfo } from './turnClock';`
- `LobbyState` gains `turnTimer: number | null;`
- `HostMessage` view becomes `| { type: 'view'; view: PlayerView; clock: ClockInfo | null }`
- Replace the `case 'view':` branch of `parseHostMessage` with:

```ts
    case 'view':
      return isRecord(raw.view) ? { type: 'view', view: raw.view as unknown as PlayerView, clock: parseClock(raw.clock) } : null;
```

- Add:

```ts
function parseClock(raw: unknown): ClockInfo | null {
  if (!isRecord(raw) || (raw.kind !== 'turn' && raw.kind !== 'response')) return null;
  const { remainingMs, totalMs } = raw;
  return typeof remainingMs === 'number' && typeof totalMs === 'number' ? { kind: raw.kind, remainingMs, totalMs } : null;
}
```

`src/net/host.ts`:
- Imports: `import { answerAtRandom, finishTurn } from '../engine/timeout';`, `import { realScheduler, TurnClock, type ClockKind, type Scheduler } from './turnClock';`, and add `createRng` (already imported).
- `export const TURN_TIMER_OPTIONS = [45, 60, 90, 120] as const;`
- `HostOptions` gains `scheduler?: Scheduler;`
- Fields: `private turnTimer: number | null = null;`, `private clock: TurnClock | null = null;`, `private readonly scheduler: Scheduler;` (set in the constructor: `this.scheduler = opts.scheduler ?? realScheduler;`)
- `lobby` getter gains `turnTimer: this.turnTimer,`
- Add:

```ts
  setTurnTimer(seconds: number | null): ApplyResult {
    if (this.activeGame) return fail('Game in progress');
    if (seconds !== null && !(TURN_TIMER_OPTIONS as readonly number[]).includes(seconds)) return fail('Invalid timer');
    this.turnTimer = seconds;
    this.broadcastLobby();
    return ok();
  }

  /** Call after every change to the game: keeps the clock in step, then sends fresh views. */
  gameChanged(): void {
    const game = this.activeGame;
    if (game && this.clock) {
      const s = game.state;
      this.clock.sync({ turn: s.turn, currentPlayer: s.turn.player, pending: s.pending, over: s.result !== null });
    }
    this.broadcastViews();
  }

  private expire(kind: ClockKind): void {
    const game = this.activeGame;
    if (!game || game.state.result) return;
    const s = game.state;
    const rng = createRng(this.newSeed());
    if (kind === 'response') {
      if (s.pending) game.note(s.pending.player, 'timeout: random answer');
      answerAtRandom(game, rng);
    } else {
      game.note(s.turn.player, 'timeout: turn ended');
      finishTurn(game, rng);
    }
    this.gameChanged();
  }
```

- In `start()`, after creating `this.activeGame` and before broadcasting:

```ts
    this.clock = this.turnTimer === null ? null : new TurnClock(this.turnTimer * 1000, this.scheduler, (kind) => this.expire(kind));
```

  Then replace `this.broadcastViews();` in `start()` with `this.gameChanged();`.
- In `handleIntent`, replace the final `this.broadcastViews();` with `this.gameChanged();`.
- In `playAgain()` and `backToLobby()`, add `this.clock?.stop(); this.clock = null;` before `this.activeGame = null;`.
- `sendView` sends `{ type: 'view', view: { ...view, log: view.log.slice(-MAX_LOG_ENTRIES) }, clock: this.clock?.info() ?? null }`.

`src/net/guest.ts`:
- `import type { ClockKind } from './turnClock';`
- Add and export:

```ts
/** A running clock as a local deadline (`Date.now()` time), so device clocks never need to agree. */
export interface LocalClock {
  kind: ClockKind;
  totalMs: number;
  deadline: number;
}
```

- `GuestState` gains `clock: LocalClock | null;` (initial state `clock: null`)
- `case 'view':` becomes:

```ts
      case 'view':
        this.update({
          view: msg.view,
          awaiting: false,
          clock: msg.clock ? { kind: msg.clock.kind, totalMs: msg.clock.totalMs, deadline: Date.now() + msg.clock.remainingMs } : null,
        });
        break;
```

- In `case 'lobby':`, when `!msg.lobby.inGame`, also clear the clock: change the spread to `...(msg.lobby.inGame ? {} : { awaiting: false, clock: null })`.

`src/i18n/en.ts` `log`:

```ts
    "timeout: turn ended": "ran out of time — turn ended",
    "timeout: random answer": "ran out of time — chose at random",
```

`src/i18n/pt.ts` `log`:

```ts
    "timeout: turn ended": "ficou sem tempo — turno encerrado",
    "timeout: random answer": "ficou sem tempo — escolha aleatória",
```

`src/i18n/en.ts` `reasons`: `"Invalid timer": "Invalid timer",`. `src/i18n/pt.ts` `reasons`: `"Invalid timer": "Tempo inválido",`

`src/i18n/coverage.test.ts`: the host writes these log lines, not the engine, so bot games never reach them:

```ts
/** Dictionary entries that no bot game reaches but real play can. */
const LOG_ALLOWLIST: string[] = ['timeout: turn ended', 'timeout: random answer'];
```

- [ ] **Step 4: Run them to see them pass, then the whole suite**

Run: `npx vitest run src/net/host-timer.test.ts src/net/protocol.test.ts src/net/guest.test.ts`
Expected: PASS.

Run: `npm test && npx tsc --noEmit`
Expected: all pass. Existing tests that compare a whole `view` message with `toEqual` need `clock: null` added.

- [ ] **Step 5: Commit**

```bash
git add src/net src/i18n
git commit -m "feat(net): optional turn timer with random auto-moves on expiry"
```

---

### Task 5: Lobby — color picker, timer setting, colored avatars

**Files:**
- Create: `src/ui/playerColor.ts`, `src/ui/components/ColorPicker.tsx`
- Modify: `src/ui/components/Avatar.tsx`, `src/ui/screens/Lobby.tsx`, `src/ui/components/Opponents.tsx`, `src/ui/screens/Board.tsx` (Opponents call only), `src/ui/screens/EndScreen.tsx` (Avatar call only), `src/ui/App.tsx`, `src/i18n/en.ts`, `src/i18n/pt.ts`, `src/styles.css`
- Test: `src/ui/playerColor.test.ts`

**Interfaces:**
- Consumes: `PLAYER_COLORS`, `colorHex`, `PlayerColorId` (Task 3); `TURN_TIMER_OPTIONS`, `HostSession.setTurnTimer` (Task 4); `GuestSession.setColor` (Task 3).
- Produces:
  - `playerColor(lobby: LobbyState, playerId: string): string` (hex)
  - `<Avatar name color online? />`: `color` is a hex string; the `seat` prop is removed
  - `<ColorPicker value taken onPick />`
  - Lobby prop `onSetColor(color: PlayerColorId): void`; EndScreen prop `lobby: LobbyState`

- [ ] **Step 1: Write the failing test**

`src/ui/playerColor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { colorHex } from '../theme/playerColors';
import { playerColor } from './playerColor';

const lobby = {
  hostId: 'p0',
  players: [
    { id: 'p0', name: 'Ana', online: true, color: 'teal' as const },
    { id: 'p1', name: 'Bo', online: true, color: 'pink' as const },
  ],
  kingdom: [],
  inGame: true,
  turnTimer: null,
};

describe('playerColor', () => {
  it('looks a player\'s color up by id', () => {
    expect(playerColor(lobby, 'p1')).toBe(colorHex('pink'));
  });

  it('falls back to the first palette color for unknown players', () => {
    expect(playerColor(lobby, 'zz')).toBe(colorHex(undefined));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/ui/playerColor.test.ts`
Expected: FAIL. `./playerColor` doesn't exist.

- [ ] **Step 3: Implement**

`src/ui/playerColor.ts`:

```ts
import type { LobbyState } from '../net/protocol';
import { colorHex } from '../theme/playerColors';

export function playerColor(lobby: LobbyState, playerId: string): string {
  return colorHex(lobby.players.find((p) => p.id === playerId)?.color);
}
```

`src/ui/components/Avatar.tsx` (replace the whole file):

```tsx
/** A player's initial on a disc in their chosen color. */
export function Avatar({ name, color, online }: { name: string; color: string; online?: boolean }) {
  return (
    <span className="avatar" style={{ background: color }} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || '?'}
      {online !== undefined && <span className={`dot ${online ? 'dot--on' : ''}`} />}
    </span>
  );
}
```

`src/ui/components/ColorPicker.tsx`:

```tsx
import type { UiKey } from '../../i18n';
import { useLang } from '../../i18n/LangProvider';
import { PLAYER_COLORS, type PlayerColorId } from '../../theme/playerColors';

const LABELS: Record<PlayerColorId, UiKey> = {
  blue: 'colorBlue', red: 'colorRed', teal: 'colorTeal', amber: 'colorAmber',
  green: 'colorGreen', purple: 'colorPurple', pink: 'colorPink', slate: 'colorSlate',
};

interface Props {
  value: PlayerColorId;
  /** Colors other players hold. */
  taken: PlayerColorId[];
  onPick(color: PlayerColorId): void;
}

export function ColorPicker({ value, taken, onPick }: Props) {
  const { tr } = useLang();
  return (
    <div className="swatches" role="radiogroup" aria-label={tr.t('yourColor')}>
      {PLAYER_COLORS.map((c) => {
        const isTaken = taken.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.id === value}
            aria-label={tr.t(LABELS[c.id])}
            title={tr.t(LABELS[c.id])}
            className={`swatch ${c.id === value ? 'is-on' : ''}`}
            style={{ background: c.hex }}
            disabled={isTaken}
            onClick={() => onPick(c.id)}
          />
        );
      })}
    </div>
  );
}
```

`src/ui/screens/Lobby.tsx`:
- Props gain `onSetColor(color: PlayerColorId): void`. Import `ColorPicker`, `colorHex`, `type PlayerColorId`, `TURN_TIMER_OPTIONS`.
- In the seat row, replace `<Avatar name={p.name} seat={i} />` with `<Avatar name={p.name} color={colorHex(p.color)} />`. For the row where `p.id === me`, render below the name line:

```tsx
                  {p.id === me && (
                    <ColorPicker
                      value={p.color}
                      taken={lobby.players.filter((o) => o.id !== me).map((o) => o.color)}
                      onPick={onSetColor}
                    />
                  )}
```

  Make each `li` wrap with `className={p.id === me ? 'is-me' : ''}` so the picker can take its own line (CSS below).
- Add a timer row inside the kingdom `<section className="panel">`, above the picker/kingdom list:

```tsx
          <div className="timer-setting">
            <Icon name="clock" />
            <label htmlFor="turn-timer">{tr.t('turnTimer')}</label>
            {host ? (
              <select
                id="turn-timer"
                value={lobby.turnTimer ?? ''}
                onChange={(e) => host.setTurnTimer(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">{tr.t('timerOff')}</option>
                {TURN_TIMER_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {tr.t('timerSeconds', { n: s })}
                  </option>
                ))}
              </select>
            ) : (
              <b id="turn-timer">{lobby.turnTimer === null ? tr.t('timerOff') : tr.t('timerSeconds', { n: lobby.turnTimer })}</b>
            )}
            {lobby.turnTimer !== null && <span className="zone__hint">{tr.t('timerHint')}</span>}
          </div>
```

`src/ui/App.tsx`:
- Pass `onSetColor={(c) => active.session.setColor(c)}` to `<Lobby>`.
- Pass `lobby={state.lobby}` to `<EndScreen>`.

`src/ui/screens/EndScreen.tsx`: add a `lobby: LobbyState` prop and replace `<Avatar name={s.name} seat={seat(s.playerId)} />` with `<Avatar name={s.name} color={playerColor(lobby, s.playerId)} />`. Remove the now-unused `seat` helper. Task 8 rewrites this screen; for now only keep it compiling.

`src/ui/components/Opponents.tsx`: add a prop `colorOf(playerIndex: number): string` and use `<Avatar name={p.name} color={colorOf(i)} online={online(i)} />`. In `Board.tsx`, define `const colorOf = (i: number) => playerColor(lobby, view.players[i].id);` and pass `colorOf={colorOf}` to `<Opponents>`.

i18n `ui` keys, `en.ts`:

```ts
  "yourColor": "Your color",
  "colorBlue": "Blue",
  "colorRed": "Red",
  "colorTeal": "Teal",
  "colorAmber": "Amber",
  "colorGreen": "Green",
  "colorPurple": "Purple",
  "colorPink": "Pink",
  "colorSlate": "Slate",
  "turnTimer": "Turn timer",
  "timerOff": "Off",
  "timerSeconds": "{n} s",
  "timerHint": "Attack responses get 30 s.",
```

`pt.ts`:

```ts
    "yourColor": "Sua cor",
    "colorBlue": "Azul",
    "colorRed": "Vermelho",
    "colorTeal": "Verde-água",
    "colorAmber": "Âmbar",
    "colorGreen": "Verde",
    "colorPurple": "Roxo",
    "colorPink": "Rosa",
    "colorSlate": "Grafite",
    "turnTimer": "Tempo por turno",
    "timerOff": "Desligado",
    "timerSeconds": "{n} s",
    "timerHint": "Respostas a ataques têm 30 s.",
```

`src/styles.css` (after the `.seats` rules):

```css
.seats li.is-me { flex-wrap: wrap; }
.swatches { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0 2px 44px; }
.swatch {
  width: 26px; height: 26px; min-height: 0; padding: 0; border-radius: 99px;
  border: 2px solid var(--surface); box-shadow: 0 0 0 2px transparent; cursor: pointer;
}
.swatch.is-on { box-shadow: 0 0 0 2px var(--text); }
.swatch:disabled { opacity: 0.25; cursor: not-allowed; }
.timer-setting { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; font-weight: 700; }
.timer-setting select { min-height: 36px; padding: 4px 10px; border-radius: var(--r-md); border: 2px solid var(--border); background: var(--surface); color: var(--text); font: inherit; }
```

- [ ] **Step 4: Run the tests and type check**

Run: `npx vitest run src/ui/playerColor.test.ts && npm test && npx tsc --noEmit`
Expected: PASS, no type errors (every `Avatar` call site now passes `color`).

- [ ] **Step 5: Commit**

```bash
git add src/ui src/i18n src/styles.css
git commit -m "feat(lobby): color picker and turn timer setting"
```

---

### Task 6: Turn board in the play area, tinted dock, timer bars

**Files:**
- Create: `src/ui/components/TurnBoard.tsx`, `src/ui/components/TurnActions.tsx`, `src/ui/components/TimerBar.tsx`, `src/ui/clock.ts`
- Delete: `src/ui/components/TurnBar.tsx`
- Modify: `src/ui/screens/Board.tsx`, `src/ui/components/PromptPanel.tsx`, `src/ui/App.tsx`, `src/i18n/en.ts`, `src/i18n/pt.ts`, `src/styles.css`
- Test: `src/ui/clock.test.ts`

**Interfaces:**
- Consumes: `LocalClock` (Task 4), `playerColor` (Task 5), `hasNoActionToPlay` (existing in `moves.ts`).
- Produces:
  - `secondsLeft(clock: LocalClock, now: number): number` and `fractionLeft(clock: LocalClock, now: number): number` in `src/ui/clock.ts`
  - `LOW_TIME_S = 10`
  - `<TimerBar clock={LocalClock} />`
  - `<TurnBoard view names clock />`: display only
  - `<TurnActions view onPlayAll onEndPhase />`: renders nothing unless it's your turn and nothing is pending
  - Board prop `clock: LocalClock | null`

- [ ] **Step 1: Write the failing test**

`src/ui/clock.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fractionLeft, secondsLeft } from './clock';

const clock = { kind: 'turn' as const, totalMs: 45_000, deadline: 100_000 };

describe('clock helpers', () => {
  it('rounds seconds up and never goes below zero', () => {
    expect(secondsLeft(clock, 100_000 - 44_001)).toBe(45);
    expect(secondsLeft(clock, 100_000 - 9_500)).toBe(10);
    expect(secondsLeft(clock, 100_500)).toBe(0);
  });

  it('gives the fraction of time left between 0 and 1', () => {
    expect(fractionLeft(clock, 100_000 - 45_000)).toBe(1);
    expect(fractionLeft(clock, 100_000 - 22_500)).toBe(0.5);
    expect(fractionLeft(clock, 200_000)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/ui/clock.test.ts`
Expected: FAIL. `./clock` doesn't exist.

- [ ] **Step 3: Implement the helpers and components**

`src/ui/clock.ts`:

```ts
import type { LocalClock } from '../net/guest';

/** The bar turns red and pulses from here down. */
export const LOW_TIME_S = 10;

export function secondsLeft(clock: LocalClock, now: number): number {
  return Math.max(0, Math.ceil((clock.deadline - now) / 1000));
}

export function fractionLeft(clock: LocalClock, now: number): number {
  return Math.min(1, Math.max(0, (clock.deadline - now) / clock.totalMs));
}
```

`src/ui/components/TimerBar.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { LocalClock } from '../../net/guest';
import { useLang } from '../../i18n/LangProvider';
import { LOW_TIME_S, fractionLeft, secondsLeft } from '../clock';
import { Icon } from './Icon';

/** A shrinking bar plus seconds, redrawn every animation frame. */
export function TimerBar({ clock }: { clock: LocalClock }) {
  const { tr } = useLang();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let frame = requestAnimationFrame(function tick() {
      setNow(Date.now());
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [clock]);
  const secs = secondsLeft(clock, now);
  return (
    <span className={`timer ${secs <= LOW_TIME_S ? 'is-low' : ''}`} role="timer" aria-label={tr.t('timeLeft', { n: secs })}>
      <Icon name="clock" />
      <span className="timer__track">
        <span className="timer__fill" style={{ width: `${fractionLeft(clock, now) * 100}%` }} />
      </span>
      <b>{secs}</b>
    </span>
  );
}
```

`src/ui/components/TurnBoard.tsx`. Move the pill, phases, info button/banner and counters out of `TurnBar.tsx` as they are, and add the timer:

```tsx
import { useState } from 'react';
import type { PlayerView } from '../../engine/view';
import type { LocalClock } from '../../net/guest';
import { useLang } from '../../i18n/LangProvider';
import { isMyTurn } from '../moves';
import { Icon } from './Icon';
import { TimerBar } from './TimerBar';

/** Action → Buy → Cleanup. Cleanup is instant in the engine, so it only ever shows as the step ahead. */
const STEPS = ['action', 'buy', 'cleanup'] as const;
const LABELS = { action: 'actionPhase', buy: 'buyPhase', cleanup: 'cleanupPhase' } as const;
const INFO = { action: 'actionPhaseInfo', buy: 'buyPhaseInfo', cleanup: 'cleanupPhaseInfo' } as const;
type Step = (typeof STEPS)[number];

interface Props {
  view: PlayerView;
  names: string[];
  clock: LocalClock | null;
}

/** Whose turn it is, which phase, what they have left, and how long. Display only. */
export function TurnBoard({ view, names, clock }: Props) {
  const { tr } = useLang();
  const mine = isMyTurn(view);
  const t = view.turn;
  const [info, setInfo] = useState<Step | null>(null);
  return (
    <>
      <div className="turnboard">
        {/* keyed on the player so the pill pops in again at every turn change */}
        <strong key={t.player} className={`turn-pill ${mine ? '' : 'is-other'}`} aria-live="polite">
          {mine ? tr.t('yourTurn') : tr.t('turnOf', { name: names[t.player] })}
        </strong>
        <ol className="phases">
          {STEPS.map((step, i) => {
            const at = STEPS.indexOf(t.phase);
            const state = i < at ? 'is-done' : i === at ? 'is-on' : '';
            return (
              <li key={step} className={state} aria-current={i === at ? 'step' : undefined}>
                {i < at && <Icon name="check" />}
                {tr.t(LABELS[step])}
                <button
                  type="button"
                  className={`info-btn ${info === step ? 'is-open' : ''}`}
                  aria-label={tr.t('phaseInfo', { phase: tr.t(LABELS[step]) })}
                  title={tr.t('phaseInfo', { phase: tr.t(LABELS[step]) })}
                  aria-expanded={info === step}
                  onClick={() => setInfo(info === step ? null : step)}
                >
                  <Icon name="info" />
                </button>
              </li>
            );
          })}
        </ol>
        <div className="counters">
          <span className="ctr">
            <Icon name="action" />
            <b>{t.actions}</b>
            {tr.t('actions')}
          </span>
          <span className="ctr">
            <Icon name="buy" />
            <b>{t.buys}</b>
            {tr.t('buys')}
          </span>
          <span className="ctr">
            <Icon name="coin" />
            <b>{'$' + t.coins}</b>
          </span>
        </div>
        {clock?.kind === 'turn' && <TimerBar clock={clock} />}
      </div>
      {info && (
        <div className="banner banner--info" role="note">
          <Icon name="info" />
          <span>
            <b>{tr.t(LABELS[info])}:</b> {tr.t(INFO[info])}
          </span>
          <button type="button" className="banner__close" onClick={() => setInfo(null)} aria-label={tr.t('dismiss')}>
            <Icon name="x" />
          </button>
        </div>
      )}
    </>
  );
}
```

`src/ui/components/TurnActions.tsx`:

```tsx
import type { PlayerView } from '../../engine/view';
import { useLang } from '../../i18n/LangProvider';
import { canPlayAllTreasures, isMyTurn } from '../moves';
import { Icon } from './Icon';

interface Props {
  view: PlayerView;
  onPlayAll(): void;
  onEndPhase(): void;
}

/** Your turn buttons. Renders nothing on other players' turns or while a choice is open. */
export function TurnActions({ view, onPlayAll, onEndPhase }: Props) {
  const { tr } = useLang();
  if (!isMyTurn(view) || view.prompt !== null || view.waitingOn !== null) return null;
  return (
    <div className="turn-actions">
      <button type="button" disabled={!canPlayAllTreasures(view)} onClick={onPlayAll}>
        <Icon name="coin" />
        {tr.t('playAllTreasures')}
      </button>
      <button type="button" className="primary" onClick={onEndPhase}>
        {view.turn.phase === 'action' ? tr.t('endActions') : tr.t('endTurn')}
      </button>
    </div>
  );
}
```

Delete `src/ui/components/TurnBar.tsx`.

`src/ui/components/PromptPanel.tsx`: add an optional prop `clock?: LocalClock | null` and render it at the top of `.prompt`, above the `<h2>`:

```tsx
        {clock?.kind === 'response' && <TimerBar clock={clock} />}
```

- [ ] **Step 4: Rewire the Board**

`src/ui/screens/Board.tsx`:
- Props gain `clock: LocalClock | null`. In `App.tsx`, pass `clock={state.clock}` to `<Board>`.
- Replace the `TurnBar` import with `TurnBoard` and `TurnActions`. Import `TimerBar` and `playerColor`. `colorOf` already exists from Task 5.
- Define `const activeColor = colorOf(view.turn.player);` and `const myColor = colorOf(view.you);`. CSS custom properties need a cast in React: `style={{ '--player': activeColor } as React.CSSProperties}`. Add `import type { CSSProperties } from 'react';` and use `as CSSProperties`.
- Insert a new section right **before** `<section className="board__play zone">`:

```tsx
      <section className="board__status" style={{ '--player': activeColor } as CSSProperties} aria-label={tr.t('turnStatus')}>
        <TurnBoard view={view} names={names} clock={clock} />
      </section>
```

- Give `board__play` the same style: `style={{ '--player': activeColor } as CSSProperties}`.
- Give `board__dock` your color: `<div className="board__dock" style={{ '--player': myColor } as CSSProperties}>`.
- Inside `board__turn`, replace `<TurnBar …/>` with:

```tsx
          <TurnActions
            view={view}
            onPlayAll={() => onIntent({ type: 'playAllTreasures' })}
            onEndPhase={() => onIntent({ type: 'endPhase' })}
          />
```

  Task 7 replaces the `onPlayAll` handler with the guarded one.
- In the waiting banner, after the message text, add `{clock?.kind === 'response' && <TimerBar clock={clock} />}`.
- Pass `clock={clock}` to `<PromptPanel>`.

i18n `ui`: en `"turnStatus": "Turn status"`, `"timeLeft": "{n} seconds left"`; pt `"turnStatus": "Situação do turno"`, `"timeLeft": "{n} segundos restantes"`.

- [ ] **Step 5: Styles**

In `src/styles.css`:
- Rename the selector `.turnbar {` to `.turnboard {`, and `.turnbar__btns` to `.turn-actions` (the desktop rule and both mobile rules). Delete `.turnbar` mentions that no longer apply. In the phone block, change `.turnbar { gap: 10px; }` to `.turnboard { gap: 10px; }`.
- Desktop grid: put `status` between `supply` and `play`:

```css
  grid-template-areas:
    'top top'
    'supply log'
    'status log'
    'play log'
    'dock dock';
```

- Add the tints and the status block. `--player` falls back to the accent:

```css
.board__status {
  grid-area: status; margin-bottom: -16px; padding: 10px 16px; z-index: 1;
  border-radius: var(--r-lg) var(--r-lg) 0 0; border: 2px solid var(--player, var(--accent)); border-bottom: 0;
  background: color-mix(in srgb, var(--player, var(--accent)) 16%, var(--surface));
}
.board__status .banner--info { margin: 10px 0 0; }
.board__play {
  border: 2px solid var(--player, var(--accent)); border-top: 0; border-radius: 0 0 var(--r-lg) var(--r-lg);
  background: color-mix(in srgb, var(--player, var(--accent)) 12%, var(--table));
}
.board__dock {
  border-top: 3px solid var(--player, var(--border));
  background: color-mix(in srgb, var(--player, var(--accent)) 10%, var(--surface));
}
.turn-pill { background: var(--player, var(--accent)); color: #fff; }
.turn-pill.is-other { background: var(--player, var(--surface-2)); color: #fff; }
.timer { display: inline-flex; align-items: center; gap: 6px; font-weight: 800; min-width: 120px; }
.timer .ico { width: 15px; height: 15px; }
.timer__track { flex: 1; height: 8px; border-radius: 99px; background: color-mix(in srgb, var(--text) 12%, transparent); overflow: hidden; }
.timer__fill { display: block; height: 100%; border-radius: inherit; background: var(--player, var(--accent)); transition: width 120ms linear; }
.timer.is-low { color: var(--danger); animation: pulse 1s ease-in-out infinite; }
.timer.is-low .timer__fill { background: var(--danger); }
.prompt .timer { width: 100%; }
@keyframes pulse { 50% { opacity: 0.55; } }
```

  Merge these into the existing `.board__play`, `.board__dock` and `.turn-pill` rules rather than duplicating selectors. Remove the old `background: var(--table)` from `.board__play`, the old `background: var(--surface); border-top: 2px solid var(--border)` from `.board__dock`, and the old `.turn-pill` colors.
- Phone block (`@media (max-width: 767px)`):

```css
  .board { grid-template-areas: 'top' 'status' 'tabs' 'turn' 'supply' 'log' 'hand' 'play'; }
  .board__status { position: sticky; top: 0; z-index: 10; margin: 0; padding: 8px 10px; border-radius: var(--r-lg); border-bottom: 2px solid var(--player, var(--accent)); box-shadow: var(--e1); }
  .board__play { border-top: 2px solid var(--player, var(--accent)); border-radius: var(--r-lg); }
  .board__turn { position: static; padding: 0; border: 0; background: transparent; box-shadow: none; }
  .board__turn:empty { display: none; }
  .board__hand { padding: 8px; border-radius: var(--r-lg); border: 2px solid var(--player, var(--border)); background: color-mix(in srgb, var(--player, var(--accent)) 10%, var(--surface)); }
```

  Replace the existing phone `grid-template-areas` and `.board__turn` rules with these rather than adding duplicates. The phone `.board__dock` stays `display: contents`, so the tint goes on `.board__hand` and `board__turn` inherits `--player` through the DOM.
- In the reduced-motion block at the end of the file, add `.timer.is-low { animation: none; }`.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

Then check it in the browser. Start the `dev` preview (`.claude/launch.json`); if port 5173 is already served by this project, navigate to it instead. Host in one tab and join from a second. Pick different colors. Confirm:
- the play area and status are tinted with the active player's color;
- your dock is always in your color;
- the opponent's dock shows no buttons on your turn;
- the phone width (375px) keeps the status sticky at the top.

Set a 45 s timer, start the game and watch the bar count down. Take a screenshot of the desktop and phone views.

- [ ] **Step 7: Commit**

```bash
git add -A src/ui src/i18n src/styles.css
git commit -m "feat(ui): colored turn board in the play area, tinted dock, timer bars"
```

---

### Task 7: Click guard during the action phase

**Files:**
- Modify: `src/ui/moves.ts`, `src/ui/components/ConfirmDialog.tsx`, `src/ui/screens/Board.tsx`, `src/i18n/en.ts`, `src/i18n/pt.ts`
- Test: `src/ui/moves.test.ts`

**Interfaces:**
- Produces:
  - `canStillPlayAction(view: PlayerView): boolean`
  - `ConfirmDialog` prop `tone?: 'danger' | 'neutral'` (default `'danger'`)

- [ ] **Step 1: Write the failing test**

Add `canStillPlayAction` to the `./moves` import in `src/ui/moves.test.ts` and add:

```ts
  it('knows when an Action could still be played', () => {
    expect(canStillPlayAction(viewFor(stateWithHand(['village', 'copper']), 'p0'))).toBe(true);
    expect(canStillPlayAction(viewFor(stateWithHand(['copper', 'estate']), 'p0'))).toBe(false);
    const noActions = stateWithHand(['village', 'copper']);
    noActions.turn.actions = 0;
    expect(canStillPlayAction(viewFor(noActions, 'p0'))).toBe(false);
    const buying = stateWithHand(['village', 'copper']);
    buying.turn.phase = 'buy';
    expect(canStillPlayAction(viewFor(buying, 'p0'))).toBe(false);
    expect(canStillPlayAction(viewFor(stateWithHand(['village']), 'p1'))).toBe(false);
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/ui/moves.test.ts`
Expected: FAIL. `canStillPlayAction is not a function`.

- [ ] **Step 3: Implement**

`src/ui/moves.ts`, next to `hasNoActionToPlay`:

```ts
/** Your Action phase and you could still play an Action: Treasures and buys would end it early. */
export function canStillPlayAction(view: PlayerView): boolean {
  return canAct(view) && view.turn.phase === 'action' && view.turn.actions > 0 && view.hand.some((id) => isType(id, 'action'));
}
```

`src/ui/components/ConfirmDialog.tsx`: add `tone?: 'danger' | 'neutral'` to `Props`, default it in the signature (`tone = 'danger'`), and change the icon and confirm button:

```tsx
        <div className="sig">
          <Icon name={tone === 'danger' ? 'x' : 'alert'} />
        </div>
```

```tsx
          <button type="button" className={tone === 'danger' ? 'danger-fill' : 'primary'} onClick={onConfirm}>
```

Update the doc comment to: `/** A small confirmation, styled like the prompt dialog. */`

`src/ui/screens/Board.tsx`:
- Import `canStillPlayAction`.
- Add state and a helper:

```tsx
  const [guard, setGuard] = useState<{ intent: Intent; body: string } | null>(null);
  /** Moves that would end the Action phase early ask first while an Action could still be played. */
  function guarded(intent: Intent, body: string) {
    if (canStillPlayAction(view)) setGuard({ intent, body });
    else onIntent(intent);
  }
```

- Hand `onPlay`:

```tsx
            onPlay={(i) => {
              const intent = intentForHandCard(view, i);
              if (!intent) return;
              if (intent.type === 'playTreasure') guarded(intent, tr.t('guardTreasure'));
              else onIntent(intent);
            }}
```

- Supply `onBuy={(card) => guarded({ type: 'buy', card }, tr.t('guardBuy', { card: tr.card(card) }))}`
- TurnActions `onPlayAll={() => guarded({ type: 'playAllTreasures' }, tr.t('guardAllTreasures'))}`
- Next to the other dialogs:

```tsx
      {guard && (
        <ConfirmDialog
          tone="neutral"
          title={tr.t('guardTitle')}
          body={guard.body}
          cancel={tr.t('guardCancel')}
          confirm={tr.t('endActions')}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            setGuard(null);
            onIntent(guard.intent);
          }}
        />
      )}
```

i18n `ui`, `en.ts`:

```ts
  "guardTitle": "End your Actions?",
  "guardTreasure": "You can still play an Action. End your Actions and play this Treasure?",
  "guardAllTreasures": "You can still play an Action. End your Actions and play all your Treasures?",
  "guardBuy": "You can still play an Action. End your Actions and buy {card}?",
  "guardCancel": "Keep my Actions",
```

`pt.ts`:

```ts
    "guardTitle": "Encerrar suas ações?",
    "guardTreasure": "Você ainda pode jogar uma Ação. Encerrar suas ações e jogar este Tesouro?",
    "guardAllTreasures": "Você ainda pode jogar uma Ação. Encerrar suas ações e jogar todos os seus Tesouros?",
    "guardBuy": "Você ainda pode jogar uma Ação. Encerrar suas ações e comprar {card}?",
    "guardCancel": "Continuar nas ações",
```

- [ ] **Step 4: Run the tests and check in the browser**

Run: `npx vitest run src/ui/moves.test.ts && npm test && npx tsc --noEmit`
Expected: PASS.

In the browser, on a turn with an Action card in hand, click a Treasure. The dialog appears; Cancel leaves the phase on Actions, and Confirm plays it and moves to Buys. On a turn with no Action card, a Treasure plays in one click.

- [ ] **Step 5: Commit**

```bash
git add src/ui src/i18n
git commit -m "feat(ui): confirm before Treasures or buys end the Action phase early"
```

---

### Task 8: Animated VP tally on the end screen

**Files:**
- Create: `src/ui/tally.ts`, `src/ui/components/Tally.tsx`
- Modify: `src/ui/screens/EndScreen.tsx`, `src/i18n/en.ts`, `src/i18n/pt.ts`, `src/styles.css`
- Test: `src/ui/tally.test.ts`

**Interfaces:**
- Consumes: `GameResult`/`PlayerScore` (engine types: `scores[i].breakdown: Record<CardId, { count: number; vp: number }>`), `playerColor` (Task 5).
- Produces:
  - `interface TallyStep { player: number; card: CardId; points: number; total: number }` (`player` is an index into `result.scores`)
  - `tallySteps(result: GameResult): TallyStep[]`
  - `stepDelay(index: number, count: number): number` (ms)
  - `<Tally result lobby onDone />`

- [ ] **Step 1: Write the failing test**

`src/ui/tally.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { GameResult } from '../engine/types';
import { stepDelay, tallySteps } from './tally';

const result: GameResult = {
  winners: ['a'],
  scores: [
    { playerId: 'a', name: 'A', vp: 13, turns: 10, breakdown: { province: { count: 2, vp: 12 }, estate: { count: 2, vp: 2 }, curse: { count: 1, vp: -1 } } },
    { playerId: 'b', name: 'B', vp: 4, turns: 10, breakdown: { gardens: { count: 1, vp: 3 }, estate: { count: 1, vp: 1 } } },
  ],
};

describe('tallySteps', () => {
  it('counts one card at a time, round-robin, highest first, curses last', () => {
    expect(tallySteps(result).map((s) => [s.player, s.card, s.points])).toEqual([
      [0, 'province', 6], [1, 'gardens', 3],
      [0, 'province', 6], [1, 'estate', 1],
      [0, 'estate', 1],
      [0, 'estate', 1],
      [0, 'curse', -1],
    ]);
  });

  it('keeps running totals that end at each player\'s score', () => {
    const steps = tallySteps(result);
    for (const [i, s] of result.scores.entries()) {
      const mine = steps.filter((x) => x.player === i);
      expect(mine.at(-1)!.total).toBe(s.vp);
    }
    expect(steps[2].total).toBe(12);
  });

  it('is empty when nobody owns a VP card', () => {
    expect(tallySteps({ winners: ['a'], scores: [{ playerId: 'a', name: 'A', vp: 0, turns: 1, breakdown: {} }] })).toEqual([]);
  });
});

describe('stepDelay', () => {
  it('speeds up and keeps a 6–8 s budget for typical games', () => {
    expect(stepDelay(0, 40)).toBeGreaterThan(stepDelay(39, 40));
    const total = Array.from({ length: 40 }, (_, i) => stepDelay(i, 40)).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(6000);
    expect(total).toBeLessThanOrEqual(8000);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/ui/tally.test.ts`
Expected: FAIL. `./tally` doesn't exist.

- [ ] **Step 3: Implement the pure helpers**

`src/ui/tally.ts`:

```ts
import type { CardId, GameResult } from '../engine/types';

export interface TallyStep {
  /** Index into `result.scores`. */
  player: number;
  card: CardId;
  points: number;
  total: number;
}

/** Target length of the whole count, in ms. */
const TALLY_MS = 7000;
const MIN_STEP_MS = 90;
const MAX_STEP_MS = 650;

/**
 * The order the end screen counts VP cards in: one card per player per round,
 * each player's cards from most to fewest points, so Curses come last. Gardens
 * counts at its worked-out per-card value. Pure, so every browser shows the same count.
 */
export function tallySteps(result: GameResult): TallyStep[] {
  const queues = result.scores.map((s) =>
    Object.entries(s.breakdown)
      .flatMap(([card, row]) => Array.from({ length: row.count }, () => ({ card: card as CardId, points: row.vp / row.count })))
      .sort((a, b) => b.points - a.points),
  );
  const totals = result.scores.map(() => 0);
  const steps: TallyStep[] = [];
  for (let round = 0; queues.some((q) => round < q.length); round++) {
    queues.forEach((q, player) => {
      const next = q[round];
      if (!next) return;
      totals[player] += next.points;
      steps.push({ player, card: next.card, points: next.points, total: totals[player] });
    });
  }
  return steps;
}

/** A little slower at the start, faster at the end, about TALLY_MS in all. */
export function stepDelay(index: number, count: number): number {
  const progress = count <= 1 ? 0 : index / (count - 1);
  const base = TALLY_MS / Math.max(1, count);
  return Math.round(Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, base * (1.4 - 0.8 * progress))));
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/ui/tally.test.ts`
Expected: PASS (4 tests).

If the 40-step budget lands just outside 6000–8000, adjust only the `1.4`/`0.8` factors so the average multiplier is 1.0. With `1.4 - 0.8p`, the mean over `p ∈ [0,1]` is 1.0, so 40 × 175 ≈ 7000.

- [ ] **Step 5: Build the Tally component and the new end screen**

`src/ui/components/Tally.tsx`:

```tsx
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { GameResult } from '../../engine/types';
import type { LobbyState } from '../../net/protocol';
import { useLang } from '../../i18n/LangProvider';
import { primaryType } from '../format';
import { playerColor } from '../playerColor';
import { stepDelay, tallySteps } from '../tally';
import { Avatar } from './Avatar';

interface Props {
  result: GameResult;
  lobby: LobbyState;
  onDone(): void;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts VP cards onto a bar per player, then calls onDone. */
export function Tally({ result, lobby, onDone }: Props) {
  const { tr } = useLang();
  const steps = useMemo(() => tallySteps(result), [result]);
  const [shown, setShown] = useState(() => (reducedMotion() ? steps.length : 0));
  const done = shown >= steps.length;

  useEffect(() => {
    if (done) {
      onDone();
      return;
    }
    const timer = setTimeout(() => setShown((n) => n + 1), stepDelay(shown, steps.length));
    return () => clearTimeout(timer);
  }, [shown, done]);

  const best = Math.max(1, ...result.scores.map((s) => s.vp));
  return (
    <div className="tally">
      {result.scores.map((s, i) => {
        const mine = steps.slice(0, shown).filter((x) => x.player === i);
        const last = mine.at(-1);
        const total = last?.total ?? 0;
        const won = done && result.winners.includes(s.playerId);
        return (
          <div key={s.playerId} className={`tally__row ${won ? 'is-winner' : ''}`} style={{ '--player': playerColor(lobby, s.playerId) } as CSSProperties}>
            <Avatar name={s.name} color={playerColor(lobby, s.playerId)} />
            <span className="tally__name">{s.name}</span>
            <span className="tally__track">
              <span className="tally__fill" style={{ width: `${(Math.max(0, total) / best) * 100}%` }} />
              {last && (
                <span key={mine.length} className={`lchip lchip--${primaryType(last.card)} tally__chip ${last.points < 0 ? 'is-minus' : ''}`}>
                  {tr.card(last.card)} {last.points > 0 ? `+${last.points}` : last.points}
                </span>
              )}
            </span>
            <b className="tally__vp">{total}</b>
          </div>
        );
      })}
      {!done && (
        <button type="button" className="ghost" onClick={() => setShown(steps.length)}>
          {tr.t('skip')}
        </button>
      )}
    </div>
  );
}
```

`src/ui/screens/EndScreen.tsx`:
- Add `const [revealed, setRevealed] = useState(false);`.
- The main block becomes:

```tsx
    <main className="screen end">
      {!revealed && <h1 className="tally__title">{tr.t('tallyTitle')}</h1>}
      <Tally result={result} lobby={lobby} onDone={() => setRevealed(true)} />
      {revealed && (
        <div className="end__reveal">
          <div className="trophy" aria-hidden="true">
            <Icon name="trophy" />
          </div>
          <h1>{winnerNames.length > 1 ? tr.t('sharedVictory', { names: winnerNames.join(' & ') }) : tr.t('wins', { name: winnerNames[0] })}</h1>
          {tieBroken && <p className="muted">{tr.t('tieBroken')}</p>}
          {/* the existing <div className="table-wrap">…</div> and <div className="actions actions--center">…</div>, moved here unchanged */}
        </div>
      )}
    </main>
```

  Here `const tieBroken = result.winners.length === 1 && result.scores.filter((s) => s.vp === Math.max(...result.scores.map((x) => x.vp))).length > 1;`. Move the existing `table-wrap` and `actions` blocks, unchanged, into `end__reveal` where the comment marks them. Add `useState` to the React import and import `Tally`.

i18n `ui`: en `"tallyTitle": "Counting points…"`, `"skip": "Skip"`, `"tieBroken": "Tied on points — fewer turns wins."`; pt `"tallyTitle": "Contando os pontos…"`, `"skip": "Pular"`, `"tieBroken": "Empate em pontos — vence quem jogou menos turnos."`

`src/styles.css` (after the `.end` rules):

```css
.tally { width: 100%; max-width: 760px; display: grid; gap: 12px; justify-items: stretch; }
.tally__title { font-size: clamp(28px, 4vw, 40px); margin: 0; }
.tally__row {
  display: grid; grid-template-columns: auto minmax(70px, 140px) minmax(0, 1fr) 48px; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: var(--r-lg); background: var(--surface); border: 2px solid var(--border);
  transition: box-shadow var(--dur-slow) var(--ease-out), border-color var(--dur-slow);
}
.tally__row.is-winner { border-color: var(--player); box-shadow: 0 0 0 4px color-mix(in srgb, var(--player) 30%, transparent), var(--e2); }
.tally__name { font-weight: 800; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tally__track { position: relative; height: 22px; border-radius: 99px; background: color-mix(in srgb, var(--text) 10%, transparent); }
.tally__fill { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--player); transition: width 220ms var(--ease-out); }
.tally__chip { position: absolute; right: 6px; top: 50%; translate: 0 -50%; animation: pop var(--dur-base) var(--ease-spring); }
.tally__chip.is-minus { background: var(--danger); color: var(--danger-text); }
.tally__vp { font-family: var(--font-display); font-size: 24px; text-align: right; }
.tally > button { justify-self: center; }
.end__reveal { display: grid; justify-items: center; gap: 18px; width: 100%; animation: rise var(--dur-slow) var(--ease-out); }
@media (max-width: 767px) {
  .tally__row { grid-template-columns: auto minmax(0, 1fr) 40px; }
  .tally__track { grid-column: 1 / -1; order: 1; }
}
```

In the reduced-motion block, add `.tally__fill, .tally__chip, .end__reveal { transition: none; animation: none; }`.

- [ ] **Step 6: Verify**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

Browser check: start a two-tab game. To reach the end quickly, open the host tab's console and empty piles through the game state (the host's `HostSession` is not on `window`; if there's no handle, play a short game instead, or temporarily set `supply.province = 1` in a local edit that you revert before committing). Watch the bars fill in each player's color, the curse chip go red, and Skip jump to the end. Confirm the reveal shows the trophy, table and buttons. Take a screenshot.

- [ ] **Step 7: Commit**

```bash
git add src/ui src/i18n src/styles.css
git commit -m "feat(ui): animated VP tally on the end screen"
```

---

### Task 9: Roadmap and final check

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Update the roadmap**

In `docs/ROADMAP.md`:
- Change `Last updated:` to `2026-10-05`.
- Under **2. Playtest with friends**, tick the first item: `- [x] Play a 2-player game with a friend on another network.` Then add below the list: `Round 1 feedback and what changed: docs/superpowers/specs/2026-10-05-playtest-round-1-design.md`.
- Under **5. Gameplay polish**:
  - Replace the item `Add a turn timer, or let the host skip a player who is offline.` with `- [x] Turn timer (host setting) with random auto-moves and a 30 s clock for attack responses.`
  - Replace the item `Alert players when it's their turn: a sound, a changing tab title, or both.` with:

```markdown
- [ ] **Sounds**, with a mute toggle and volume remembered per device:
  - drawing cards, playing a card, attacks, reactions (counters), game start, turn start, buying at the market, discarding;
  - your turn starting while the tab is in the background (plus a changing tab title);
  - a choice dialog opening, a shuffle, the timer's last-10-seconds tick.
```

- Under **3. Theme**, add: `- [ ] **End-screen art:** an illustration per VP card (for example a stall or market scene) that fills with the scoring player's color as the card is counted in the tally. Replaces the card chips.`
- Under **References**, add: `- Playtest round 1 spec: docs/superpowers/specs/2026-10-05-playtest-round-1-design.md` and `- Playtest round 1 plan: docs/superpowers/plans/2026-10-05-playtest-round-1.md`.

- [ ] **Step 2: Run everything**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 3: End-to-end browser pass**

In two tabs:
1. Pick colors and set a 45 s timer.
2. Start, and check the tints.
3. Trigger the click guard.
4. Let a turn time out and confirm the log line.
5. If a Militia comes up, let the response clock run out.
6. Finish a game and watch the tally.

Check the phone width (375px) for the sticky status and the tally layout.

- [ ] **Step 4: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: roadmap after playtest round 1 (sounds, VP art, timer done)"
```
