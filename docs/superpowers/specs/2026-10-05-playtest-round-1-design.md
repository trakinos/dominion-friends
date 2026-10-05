# Playtest round 1: colors, turn board, timer, click guard, VP tally

Date: 2026-10-05
Status: approved design, ready for an implementation plan

Feedback from the first real playtest. Five changes are built now. Sounds and end-screen art go on the roadmap.

## 1. Player colors

**Palette.** Eight colors that read well on light and dark backgrounds and work as a soft tint: blue, red, teal, amber, green, purple, pink and slate. They are defined once as `PLAYER_COLORS` (ids plus CSS values) and used by every component instead of today's seat-indexed `COLORS` in `Avatar.tsx`.

**Assignment (host-side, in `HostSession`).**
- A new seat gets the first free color, in palette order.
- A player picks another color in the lobby with a new guest message `{ type: 'setColor', color }`. The host accepts it only if the color is valid and free, and only before the game starts. Otherwise it replies with an `error`.
- A player who rejoins with their token keeps their seat's color.
- `LobbyPlayer` gains `color: PlayerColorId`. Board and End screen look colors up from the lobby by player id.

**Lobby UI.** Each player row shows its color. Your own row has a row of swatches; colors held by others are greyed out and can't be clicked.

**Where colors show.** Avatars, the opponent list, the turn pill, the play area (section 2), your hand dock (section 2) and the end-screen tally (section 5).

## 2. Turn board in the play area

**Play area ("On the table").**
- Its header becomes the turn board: the turn pill ("Your turn" or "Ana's turn"), the phase steps (Actions › Buys › End of turn, each with its ⓘ), the counters (Actions, Buys, $) and the timer when enabled (section 3).
- The ⓘ explanation banner opens inside the play area.
- The whole area is tinted with the **active player's** color (a soft background mix) and has a solid border in that color.

**Hand dock.**
- It is **always** tinted with **your own** color (same treatment: soft background, solid border), on every turn.
- It no longer shows phases or counters. On your turn it shows only your buttons (Play all Treasures, End Actions / End turn) and the "No Actions to play" shortcut. On other turns it shows no turn controls.
- The "waiting for X to choose…" banners stay in the dock.

**Phone layout.** A compact turn board (pill, phase steps, counters, timer), tinted in the active player's color, takes the sticky top slot the turn bar uses today. The rest of the play area stays where it is.

**Code shape.** Split today's `TurnBar` into `TurnBoard` (pill, phases, info, counters, timer: display only) and `TurnActions` (the buttons). Color tints come from a CSS custom property (`--player`) set inline on the play area and the dock.

## 3. Turn timer

**Setting.**
- `LobbyState` gains `turnTimer: number | null` (seconds). Options: Off (default), 45, 60, 90, 120.
- The host changes it in the lobby next to the kingdom with `HostSession.setTurnTimer(seconds | null)`. Guests see it read-only. It is locked once the game starts.

**Two clocks, both run by the host** (a new `TurnClock` unit owned by `HostSession`, with injectable time and timers for tests):
- **Turn clock:** `turnTimer` seconds, starting when a turn begins. It keeps running while the current player answers prompts from their own cards.
- **Response clock:** 30 seconds, starting when a prompt is pending for a player **other than** the current player (attack responses such as Militia discards, Moat reveals and Bandit choices). While it runs, the turn clock is paused. When the response is answered or times out, the turn clock resumes with the time it had left.
- With the timer Off, neither clock runs, including the response clock.

**On expiry.**
- **Response clock:** the host answers the pending prompt with a random valid answer for that player.
- **Turn clock:** the host auto-finishes the turn. It repeatedly answers the current player's pending prompts with random valid answers and sends `endPhase` until the turn passes to the next player or the game ends. It never plays or buys cards.
- Auto-moves go through the normal `Game.apply` path as that player's intents. The log adds an entry: "Time's up: {name}'s turn ended" or "Time's up: {name} answered at random", in both languages.

**Random answers.** `randomAnswer(prompt, rng)` in `src/engine/` returns a legal `PromptAnswer` for every prompt kind:
- `chooseCards`: a random count between `min` and `max`, drawn from `selectable`;
- `chooseSupply`: a random pile, or `null` when optional and drawn as such;
- `chooseOption`: a random index;
- `orderCards`: a random permutation.

It must always pass `validateAnswer`.

**Getting the time to clients.** `HostMessage` `view` gains `clock: { kind: 'turn' | 'response'; remainingMs: number; totalMs: number } | null`. The host sends it with every view broadcast, and once more whenever a clock starts, pauses or resumes. Each client turns `remainingMs` into a local deadline when the message arrives and counts down with `requestAnimationFrame`, so device clocks never need to agree.

**Display.**
- In the turn board: a thin bar in the active player's color that shrinks, plus the seconds left.
- In the choice dialog (for the player answering) and in the "waiting for…" banner (for everyone else): the response clock.
- Last 10 seconds: the bar turns red and pulses.
- Disconnected players are timed like anyone else.

## 4. Click guard in the action phase

**When it applies.** `canStillPlayAction(view)`: it's your Action phase, nothing is pending, you have at least 1 Action, and you hold an Action card.

**Behavior.** While it's true, these open a confirm dialog (the existing `ConfirmDialog`) instead of acting right away:
- clicking a Treasure in hand: "End your Actions and play this Treasure?";
- "Play all Treasures": "End your Actions and play all Treasures?";
- clicking a Market pile: "End your Actions and buy {card}?".

Confirm sends the intent (the engine already ends the action phase on these). Cancel does nothing. When `canStillPlayAction` is false, everything stays one click, as it is today.

**Market during the Action phase.** Piles you can afford stay highlighted during the Action phase, so this guard is the only thing standing in the way of a buy.

## 5. End screen: animated VP tally

**Sequence.**
1. The end screen opens on a tally: one row per player (avatar, name, a bar in the player's color, a running VP number).
2. VP cards are counted one at a time, round-robin across players, from each player's `breakdown`. Each step shows a small card chip landing on the bar, grows the bar by that card's points and ticks the number up. Curses push the bar back down and flash red. Gardens counts at its worked-out per-card value.
3. Bars are scaled to the final top score.
4. Pacing: about 6–8 s in total, with steps speeding up a little as the count goes on. A **Skip** button jumps to the end.
5. When counting ends, the winner rows glow and the title appears (winner, or shared victory; a tie broken by fewer turns is noted). The existing breakdown table and buttons (Play again, Back to lobby, Leave) fade in below.

**Rules.**
- The step order comes from the `GameResult` alone (`tallySteps(result)` is a pure function), so every browser shows the same sequence.
- With `prefers-reduced-motion`, it shows the final state straight away.

## 6. Roadmap additions (not built in this round)

- **Sounds** (Gameplay polish):
  - from the playtest: drawing cards, playing a card, attacks, reactions (counters), game start, turn start, buying at the market and discarding;
  - also: turn start while the tab is in the background, a choice dialog opening, a shuffle and the timer's last-10 s tick;
  - a mute toggle and volume, remembered per device.
- **End-screen art** (Theme): an illustration per VP card (for example a stall or market scene) that fills with the scoring player's color as the card is counted in the tally. It replaces the card chips.
- Playtest section: tick "Play a 2-player game with a friend on another network" and link this spec as the round's feedback.

## Testing

**Unit tests.**
- `randomAnswer` always passes `validateAnswer` for every prompt kind, fuzzed over seeded random prompts.
- Turn auto-finish always reaches the next player's turn or the game's end, including mid-prompt and mid-attack, over many seeded games.
- `TurnClock`: the turn clock pauses during a response clock and resumes with the time it had left; expiries fire the right auto-moves; no clocks run when the timer is Off. Uses fake timers.
- Colors: first free color on join; uniqueness enforced; invalid colors refused; color kept on rejoin; locked once the game starts.
- `canStillPlayAction` truth table.
- `tallySteps`: step order, running totals, curses as negative steps, and the final totals matching `scores`.
- i18n coverage keeps passing with the new strings in both dictionaries.

**Browser check.** A two-tab game: pick colors, check the tints on the play area and dock, see the click guard, let a 45 s timer run out (including during a Militia attack if one comes up), and finish a game to watch the tally.

## Out of scope

Sounds, end-screen art, and any change to the game rules.
