# Changelog — Dominion Friends

What changed for players, newest first. Every push to `main` deploys to https://trakinos.github.io/dominion-friends/.

## Unreleased — Card animations

### Added
- **Drawing.** Cards you draw fly from your deck into your hand, one after another.
- **Discarding.** Cards you discard fly from your hand or the play area onto your discard pile, including at Clean-up, before the new hand is drawn. Cards discarded straight from your deck (Vassal, Sentry, Library) fly from the deck. When another player's turn ends, their play area flies to their seat at the top.
- Animations are skipped with reduced motion and while the tab is in the background.

## 2026-10-05 — Playtest round 1

Feedback from the first game with friends. Spec: `docs/superpowers/specs/2026-10-05-playtest-round-1-design.md`. Reasoning behind the coding decisions: `docs/journal/dominion-friends-impl-10052026.md`.

### Added
- **Player colors.**
  - Each player gets one of 8 colors (blue, red, teal, amber, green, purple, pink, slate), starting with the first free one.
  - Players change colors in the lobby; colors someone else holds are greyed out.
  - Colors can't change during a game. A player who refreshes keeps their color, in the lobby and in a game.
- **Turn board in the play area.**
  - The turn label, the steps (Actions › Buys › End of turn, each with its ⓘ), the counters and the timer now sit at the top of the "On the table" area.
  - That area is tinted with the active player's color.
  - Your hand area takes your color only on your turn and is neutral otherwise.
  - On phones the turn board stays fixed at the top of the screen.
- **Turn timer.**
  - The host chooses Off (the default), 45, 60, 90 or 120 s in the lobby.
  - A player answering another player's card, such as an attack, gets their own 30 s clock, and the turn clock waits for them.
  - When time runs out, open choices are answered at random and the turn ends. A timeout never plays or buys a card: Throne Room and Vassal decline.
  - Each timeout shows in the log.
- **Action-phase click guard.** While you could still play an Action, clicking a Treasure, Play all Treasures or a Market card first asks "End your Actions?". The dialog closes by itself if the turn moves on.
- **Animated VP tally.**
  - The end screen counts victory cards onto a bar per player, in their color, one card at a time, round-robin. Curses count down in red.
  - It takes about 7 s. There's a Skip button, and it honours reduced motion.
  - The winner, the score table and the buttons follow. A tie broken by fewer turns is called out.

### Fixed
- The timer could briefly show more seconds than its total.
- On phones, the PT/EN toggle covered the first tally row.
- The turn clock kept running in the host's tab after the host left.
- White text on the amber turn label was hard to read. Amber and pink were darkened, and all 8 colors now reach 4.5:1 contrast.

### Roadmap
- Added sounds: drawing, playing, attacks, reactions, game start, turn start, buying and discarding. Also a turn start while the tab is in the background, a choice opening, a shuffle and the timer's last 10 s, plus a mute toggle and volume.
- Added end-screen art that fills with the player's color as each VP card is counted.

## 2026-10-04 — Feira theme and quality of life

### Added
- **Feira theme:** Brazilian street-market card names (Centavo/Moeda/Nota, Banca/Barraca/Mercadão, Fiado for Curse, and so on), the striped-awning visual system and new screen layouts.
- **Portuguese by default,** with an EN/PT toggle that each player sets for themselves.
- **Turn steps** Actions › Buys › End of turn, with completed steps checked off.
- **ⓘ explanation** for each phase.
- **End-of-game counter** in the Market header (Grand Markets left, empty piles x/3), with the rules behind an ⓘ.
- **"No Actions to play · End Actions" shortcut** above your hand when nothing can be played.
- **Default kingdom:** new rooms start with the rulebook's "First Game" kingdom, and a **Default** button resets to it.
- **Legend** of the card icons (+Card, +Action, +Buy, +$, cost), the pile icons and the card-type colors.
- **Invite links** open a join-only screen ("You've been invited"), with a link to host instead.

## Earlier

Rules engine (all 26 base-set kingdom cards), peer-to-peer online play over PeerJS, Home/Lobby/Board/End screens, dark mode, phone layout and deploys from GitHub Actions. See `docs/ROADMAP.md` → Done.
