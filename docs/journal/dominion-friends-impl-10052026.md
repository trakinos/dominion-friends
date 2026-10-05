# Dominion Friends — Implementation Journal (Playtest round 1)
*October 5, 2026*

What was built and why it was asked for is in the spec, `docs/superpowers/specs/2026-10-05-playtest-round-1-design.md`. The task breakdown is in `docs/superpowers/plans/2026-10-05-playtest-round-1.md`. This journal covers the decisions made while coding (branch `feat/playtest-round-1`, commits `2b46b7a`..`52ab334`).

## Decisions Made

### Turn timer lives on the host, not in the engine
**Chose:** `TurnClock` in `src/net/turnClock.ts`, owned by `HostSession`. The engine only gained pure helpers: `randomAnswer`, `answerAtRandom` and `finishTurn` (`src/engine/randomAnswer.ts`, `src/engine/timeout.ts`), plus `Game.note()` for log lines.
**Why:** The engine is deterministic and has no idea of time. That is what makes replays and the seeded simulation tests work. Time only matters to the host, which already decides when moves happen.
**Alternatives considered:** Timer state in `GameState`, ticked by intents. Rejected because it would mix wall-clock time into the rules and the snapshots.

### TurnClock spots a new turn or prompt by object identity
**Chose:** `sync()` compares `state.turn` and `state.pending` by reference. A new object means a new turn or a new prompt.
**Why:** The engine already builds a fresh `turn` object at each turn change and a fresh `pending` object for each prompt. Reference checks need no turn counter or prompt ID matching, and they handle consecutive prompts for the same player correctly.
**Alternatives considered:** Comparing `turn.player` or a turn number. That misses a turn that comes back to the same player (2-player games), and prompt IDs are not unique across prompts.

### Injectable Scheduler, with fakeScheduler for tests
**Chose:** a `Scheduler` interface (`now`, `set`, `clear`) with `realScheduler` as the default in `HostOptions`, and a manual `fakeScheduler()` in `src/net/testing.ts` whose `advance(ms)` fires due tasks in order.
**Why:** Tests decide exactly when time moves, with no dependence on Vitest fake-timer globals. They stay compatible with the async `flush()` used by the memory transport.
**Alternatives considered:** `vi.useFakeTimers()`. It also fakes the microtask and timeout paths that `flush()` relies on, which makes the network tests brittle.

### Guests turn remainingMs into a local deadline
**Chose:** the host sends `{ kind, remainingMs, totalMs }` with every view. `GuestSession` stores `deadline = Date.now() + remainingMs` (`LocalClock`).
**Why:** Device clocks never have to agree, only the network delay is off. Each new view resyncs the deadline.
**Alternatives considered:** Sending an absolute host timestamp. That breaks when a phone's clock is minutes off.

### Auto-moves go through Game.apply as the owning player
**Chose:** `answerAtRandom` calls `game.apply(ownerId, answerPrompt)`. `finishTurn` loops random answers and `endPhase` until the turn object changes, with a cap of 500 forced moves. It never plays or buys.
**Why:** Every forced move passes the same validation as a human move, so a timeout can never put the game in a state a player couldn't reach. Plays or buys were left out so a timed-out player is never hurt by moves they didn't choose.
**Alternatives considered:** Mutating state directly to skip to the next turn. Faster, but it bypasses cleanup and draw rules.

### Expiry handler order (deviation, Task 4)
**Chose:** `HostSession.expire` writes the log note, makes the random move(s), then calls `gameChanged()` once, which syncs the clock and broadcasts.
**Why:** A sync after only the note would see the same turn object and restart the turn timer with the stale remaining time (0) on that turn. A single sync after the move sees the new turn or prompt and starts a fresh clock.

### Colors are stored on lobby seats and the host decides
**Chose:** `Seat.color` on the host. A joining player gets the first free color in `PLAYER_COLORS`. A guest can request a color with `setColor`; the host refuses taken colors and any change once a game has started. The seat keeps its color on rejoin (token match). Clients read colors from `LobbyState.players[].color` via `playerColor()`.
**Why:** The host already decides everything in the lobby. Seat data survives reconnects, and the engine stays theme-free.
**Alternatives considered:** Colors in `PlayerView`/engine state (rejected because colors are presentation). Letting each client pick freely (rejected because two players could end up with the same color).

### Guest setColor test sends `welcome` first (deviation, Task 3)
`GuestSession.setColor` does nothing until the status is `joined`, so the test fakes a `welcome` before calling it. This matches real use: the picker only shows in the lobby, after joining.

### Tints use one CSS custom property, `--player`
**Chose:** components set `--player` inline. The status block and play area get the active player's color; the dock gets your own color. CSS uses `color-mix(in srgb, var(--player) N%, var(--surface))` for the tints and `var(--player, var(--accent))` as the fallback. In `Board.tsx` these are the style objects `activeTint` and `myTint` (deviation, Task 6).
**Why:** One variable covers borders, fills, the turn pill and the timer bar, with no per-color classes. The 8 mid-tone hexes stay readable at 10–16% on both light and dark backgrounds.
**Alternatives considered:** A class per color (8 × several rules), or computing tint hexes in JS.

### Status block joined to the play area with a negative margin
**Chose:** a new grid area `status`, sitting just above `play`. `.board__status` has `margin-bottom: -16px` (cancelling the grid gap), rounded top corners and no bottom border. `.board__play` has no top border. Together they look like one tinted panel.
**Why:** The spec wanted the turn board inside the play area. Keeping them as separate grid areas lets them move apart on phones.
**Alternatives considered:** Nesting the turn board inside the `board__play` section. It couldn't then be made sticky on its own on phones.

### On phones, the status block is sticky and the buttons stay in the dock
**Chose:** below 768px the grid order becomes `status, tabs, turn, ...`. `.board__status` is `position: sticky; top: 0`, and `.board__turn:empty` is hidden.
**Why:** On a phone the most useful thing to keep in view is whose turn it is, with the timer. The action buttons stay next to the hand.

### TurnBar renamed to TurnBoard; buttons split into TurnActions (deviation, Task 6)
`TurnBar.tsx` was moved with `git mv` to `TurnBoard.tsx`, which keeps its history. It shows status only (pill, phases, counters, timer). The buttons moved to the new `TurnActions.tsx`, which renders nothing on other players' turns. The timer sits on the right of the board via `margin-left: auto`. A planned `.seats li.is-me` wrap rule was dropped because the row already wraps.

### Click guard reuses ConfirmDialog with a `tone` prop
**Chose:** `ConfirmDialog` gained `tone?: 'danger' | 'neutral'` (default `danger`, so existing uses don't change). The guard uses `neutral`: an alert icon and a primary button. `canStillPlayAction(view)` in `moves.ts` decides when it shows: on a Treasure click, Play all Treasures, or a buy.
**Why:** It reuses an existing, accessible modal. A pure predicate is easy to test with a truth table.
**Alternatives considered:** A new dialog component, or an inline "are you sure" toast that users could miss.

### VP tally is a pure step list plus a delay curve
**Chose:** `tallySteps(result)` in `src/ui/tally.ts` builds a deterministic sequence: one card per player per round, highest VP first, so Curses come last. Gardens counts at its per-card value. `stepDelay(i, n)` targets about 7 s in total, slower at the start and faster at the end, clamped to 90–650 ms. `Tally.tsx` just steps through them, and skips straight to the end under `prefers-reduced-motion`.
**Why:** It can be tested without React, every browser shows the same count, and the animation length stays roughly the same whatever the deck size.

### Tally i18n and CSS details (deviation, Task 8)
The skip button reuses the existing `skip` i18n key instead of adding a new one. The tally heading uses `.end .tally__title` so it overrides `.end h1`.

### Test count (deviation, Task 1)
The plan expected "4 + 3" engine tests. The final suites are `randomAnswer.test.ts` (2 tests; one covers all prompt kinds in a loop) and `timeout.test.ts` (4). This was a miscount in the plan, and no coverage is missing.

## Assumptions
- Network delay is small compared with the clock, so a guest's local deadline is off by at most a few hundred ms.
- The host's tab keeps running timers. Browsers throttle background tabs, so a host in a background tab may fire expiries late, but never early.
- A random answer is an acceptable penalty for running out of time on a prompt. Forced moves never play or buy for the player.
- 8 colors are plenty for a maximum of 4 players. Colors fall back to blue if a seat somehow has none.
- The 30 s response clock (`RESPONSE_MS`) is fixed, not a host setting.

## Deferred / Out of Scope
- Sounds (turn start, attacks, buys, shuffle, last-10-seconds tick, mute/volume). Added to `docs/ROADMAP.md` under polish.
- End-screen VP art that fills with the player's color during the tally. Added to the roadmap under Theme.
- Host "skip offline player". The turn timer covers most of this need.
- Any change to the game rules.

## Open Items
- **TimerBar can show more than the total** (for example 48 on a 45 s timer). When the tab isn't painting, `now` in `TimerBar` is stale at the moment a new `clock` arrives, so `deadline - now` is briefly larger than `totalMs`. Fix: reset `now` when `clock` changes, or clamp `secondsLeft` to `totalMs / 1000`.
- **PT/EN toggle overlaps the first tally row's VP number on phones.** The language toggle is fixed in position and sits over the right edge of the first `.tally__row`. Fix: pad the tally top on small screens or move the toggle on the end screen.
- **Test gaps:** there are no component tests for `TimerBar`, `Tally`, `TurnBoard` or the guard dialog; they were only checked in the browser. There is no test for host expiry while the host's tab is backgrounded, and no multi-device test of clock drift.
