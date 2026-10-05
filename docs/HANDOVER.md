# Handover — Dominion Friends (for a new Claude Code session)

Last updated: 2026-10-05. Read this first, then `docs/ROADMAP.md`. What changed for players: `docs/CHANGELOG.md`.

## What this is
A browser deck-building card game for 2–4 friends. It uses Dominion 2nd-edition base-set rules, re-themed as "Feira" (a Brazilian street market: Centavo/Moeda/Nota, Banca/Barraca/Mercadão, Fiado for Curse), the way Tanto Cuore re-themed Dominion. One player hosts from their own browser tab and the others join with a room code or link. Play is peer-to-peer over WebRTC (PeerJS), with no game server.

- **Live:** https://trakinos.github.io/dominion-friends/. Every push to `main` deploys through GitHub Actions, after typecheck, tests and build pass.
- **Repo:** https://github.com/trakinos/dominion-friends (public). The remote is SSH (`git@github.com:trakinos/dominion-friends.git`), and a plain `git push` works.
- **Language:** Brazilian Portuguese by default, with an EN/PT toggle that each player sets for themselves.
- **Status:** deployed and browser-tested. Playtest round 1 is done and its feedback shipped on 2026-10-05: player colors, a colored turn board, the turn timer, the click guard and the VP tally. Next: more playtests, 3–4 players and phones; see `docs/ROADMAP.md`.

## Commands
```bash
npm run dev          # http://localhost:5173 (open 2 tabs to play against yourself)
npm test             # 270 tests, ~3s (Vitest)
npm run typecheck    # tsc --noEmit (TypeScript 7)
npm run build        # tsc + vite build → dist/
```
`.claude/launch.json` has a `dev` entry for the preview tools.

Stack: React 19, Vite 8, TypeScript 7 (strict), Vitest, PeerJS 1.5.5, Node 24.

## Architecture
```
src/engine/   pure rules: GameState, Game.apply(playerId, intent), prompts, scoring, viewFor (hidden info),
              randomAnswer + timeout.ts (forced moves for the turn timer)
src/cards/    card data (data.ts) + effects as generator functions (effects/*.ts) + registry
src/sim/      Big Money bot (used by simulation/coverage tests)
src/net/      HostSession (authoritative, host's tab: seats, colors, timer setting), GuestSession (every player incl. host),
              TurnClock (turn + 30 s response clocks), protocol, PeerJS adapter (peer.ts), heartbeat, in-memory transport for tests
src/i18n/     pt/en dictionaries, translator(lang), LangProvider/useLang
src/theme/    Feira card names (THEME_NAMES, also the English card dictionary source), player color palette (playerColors.ts)
src/ui/       React: App (screen routing), screens/{Home,Lobby,Board,EndScreen}, components/* (TurnBoard, TurnActions,
              TimerBar, ColorPicker, Legend, Tally, …), pure helpers (moves, tally, clock, playerColor)
```
**Data flow:**
1. A player clicks, and `GuestSession.sendIntent` sends the intent over a `Connection`.
2. `HostSession` validates it and calls `game.apply` inside a try/catch.
3. The host sends a fresh per-player `viewFor` view to everyone, or an `{type:'error'}` only to the sender.
4. React renders the `GuestSession` state.

The host's own UI talks to its `HostSession` over an in-memory connection, so there is a single code path.

**Turn timer:**
- `HostSession` owns a `TurnClock`. After every change to the game, `gameChanged()` syncs the clock and then broadcasts the views.
- At expiry the host writes a log note and applies forced moves through `Game.apply`: `answerAtRandom`, or `finishTurn`, which answers at random and sends End Phase.
- Each view carries `clock: {kind, remainingMs, totalMs}`. Guests turn that into a local deadline, so device clocks never need to agree.

**Card effects** are generator functions that `yield` prompts. The paused generator lives only in the host's memory, which is why a game can't be saved or resumed and ends if the host leaves. Effect files import types only; `registry.ts` reads `EFFECTS` at module load, so a runtime import from an effect file would create a circular-import bug.

## Hard-won lessons (don't relearn these)
- **PeerJS JSON serialization silently drops messages ≥16300 bytes.** It emits an 'error' event, not an exception. We use `serialization: 'binary'`, which chunks large messages, and cap each view's log at 150 entries (`MAX_LOG_ENTRIES` in `host.ts`). `message-size.test.ts` guards this.
- **Closed or crashed tabs never fire DataConnection 'close'.** `src/net/heartbeat.ts` wraps both PeerJS ends (4s ping, 12s silence closes the connection, local timer stalls are tolerated). The host also closes its peer on `pagehide`.
- **Double-clicks:** the engine accepts some stale repeated intents (double buy, index shift). `GuestSession` has an `awaiting` guard that drops intents until the host replies.
- **The in-memory transport hides real-network bugs.** Always do a two-tab browser check after networking or UI changes, ideally against the deployed site too.
- **TurnClock compares the engine's `turn` and `pending` objects by identity** to tell a new turn or prompt from a repeated broadcast. Pass `game.state.turn` and `game.state.pending` themselves, never copies. At expiry, apply the forced moves first and sync once afterwards; otherwise the clock restarts with the expired turn's leftover time.
- **A timeout never plays or buys a card.** Prompts in `PLAYS_A_CARD` (Throne Room, Vassal) are declined, and everything else is random. A new card whose prompt leads to `ctx.playCard` must be added to that set.
- **Translations:** engine prompts carry `id`/`params`, and options carry `optionIds`. `src/i18n/coverage.test.ts` plays 200 bot games plus illegal intents and fails if any prompt id, option, log text or rejection reason is missing from either dictionary. **Any new card or message needs entries in both `pt.ts` and `en.ts`.** English card names come from `src/theme`, and English card text from `src/cards/data.ts`.

## Conventions
- **Process:** we use the superpowers workflow. Brainstorm → spec in `docs/superpowers/specs/` → plan in `docs/superpowers/plans/` → subagent-driven execution, with a fresh implementer and a reviewer per task, a final opus review, then a two-tab browser check. Execution tracking lives in `.superpowers/sdd/progress.md`; it is git-ignored via `.git/info/exclude` and is local only.
- **Branches:** work on a feature branch, merge it into `main`, push (which deploys), then delete the branch.
- **Commits:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. A local hook (`.git/hooks/commit-msg`) normalizes any Claude trailer to this. It isn't versioned, so recreate it on a new clone if needed.
- **Tests:** TDD. Tests live next to the code. Test output must be clean, with no stray warnings.
- **Randomness:** no `Math.random()` in `engine/` or `cards/`, which use the seeded RNG in state. `net/` takes an injectable `random`.
- **Untrusted input:** guests are untrusted. Illegal intents return `{ok:false, reason}` and leave state unchanged; `fuzz.test.ts` guards this.

## Docs map
| File | What |
|---|---|
| `docs/ROADMAP.md` | What's done and what's next (playtests → rules/tutorial → animations, sounds → polish) |
| `docs/CHANGELOG.md` | What changed for players, by date |
| `docs/superpowers/specs/2026-10-05-playtest-round-1-design.md` | Playtest round 1 design (colors, turn board, timer, click guard, VP tally) |
| `docs/journal/dominion-friends-impl-10052026.md` | Why playtest round 1 was built the way it was, with deviations and the "option C" timeout decision |
| `docs/superpowers/specs/2026-10-04-dominion-friends-design.md` | Original game design (rules, engine, networking, UI) |
| `docs/superpowers/specs/2026-10-04-portuguese-design.md` | i18n design |
| `docs/superpowers/plans/*.md` | The executed plans (engine, networking+UI, Portuguese, playtest round 1), including deliberate deviations |
| `docs/design/HANDOVER-DESIGN.md` | Brief for the visual design / theme work (Claude Design) |

## Known gaps (deliberately deferred)
- Cards that are set aside or revealed (Library, Sentry, Bandit) aren't stored anywhere in game state while a prompt is open, so the UI can't show them.
- The awaiting guard is cleared by any view, which leaves a narrow window for a stale click.
- The prompt dialog has no focus management.
- Connections from refused or unseated peers stay open until those players leave.
- The host's `pagehide` close doesn't handle restores from the back/forward cache.
- No TURN relay, so strict networks may fail to connect. Add one if playtests show it is needed.
- The Sentry and Artisan prompt ids are allowlisted in the coverage test, because the bot never triggers them. The timeout log lines are allowlisted too, because the host writes them, not the engine.
- No React component tests (there's no testing library). TimerBar, Tally, ColorPicker and the click-guard dialog are covered only through their pure helpers and two-tab browser checks.
- While the current player answers their own prompt, the prompt dialog covers the turn board, so the turn timer isn't visible.
- An invalid `setColor` from a guest is dropped silently, with no error reply.

## Next steps (from the roadmap)
1. Playtest again: 3–4 players, at least one on a phone, with the timer on. Collect feedback.
2. Theme: card art and the VP-tally art (cards fill with the player's color). See `docs/design/HANDOVER-DESIGN.md`.
3. Add a rules page and tutorial tips (new UI keys in both dictionaries).
4. Sounds (list in the roadmap), animations, set-aside/revealed display, bots.
