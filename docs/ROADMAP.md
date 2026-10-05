# Dominion Friends — Roadmap

Last updated: 2026-10-05

## Done

- [x] **Rules engine:** Dominion 2nd-edition base set with all 26 kingdom cards. Tested with 200 simulated games and fuzzed against malformed input. (Plan 1)
- [x] **Online play:** one player hosts from their browser and friends join by room code or link over PeerJS. Includes rejoining after a refresh, heartbeat-based disconnect detection, and an "End game" button for the host. (Plan 2)
- [x] **UI:** Home, Lobby with kingdom picker, Board with choice dialogs, and End screen with Play again. Supports dark mode and a phone layout.
- [x] **Deploy workflow:** GitHub Actions runs typecheck, tests and build, then publishes to GitHub Pages.
- [x] **Solo test:** two tabs on one machine.

## Now

### 1. Put it online ✅
Nothing else is needed before friends anywhere can play.
- [x] Create a GitHub repository and push `main`: https://github.com/trakinos/dominion-friends
- [x] Set **Settings → Pages → Source** to **GitHub Actions**.
- [x] Open the Pages URL and host a game from it: **https://trakinos.github.io/dominion-friends/**

### 2. Playtest with friends
Real players will find what two tabs on one machine can't.
- [x] Play a 2-player game with a friend on another network.
- [ ] Play a 3–4 player game, including at least one player on a phone.
- [ ] Try the awkward cases: someone refreshes, someone's phone locks, the host leaves.
- [ ] Watch for players who can't connect at all. Strict networks (office, university, some mobile carriers) can block direct browser-to-browser connections. If that happens, see "Relay server" under Next.
- [ ] Write down what was confusing, slow or annoying. That feedback ranks the polish items below.

Round 1 feedback and what changed: `docs/superpowers/specs/2026-10-05-playtest-round-1-design.md`

## Next

### 3. Theme (the Tanto Cuore step)
The game rules don't change; only the presentation does.
- [ ] Choose the theme.
- [ ] Rename all 33 cards in `src/theme/index.ts`.
- [ ] Set colors and fonts in `src/styles.css`.
- [ ] Add card art: images supplied or generated, plus an image slot in the card frame.
- [ ] Optionally, rewrite the card text in the theme's voice. The rules stay the same.
- [ ] **End-screen art:** an illustration per VP card (for example a stall or market scene) that fills with the scoring player's color as the card is counted in the tally. Replaces the card chips.

### 4. Learning the game
New players should be able to learn without someone explaining it.
- [ ] **Rules:** an in-game rules page that covers setup, the turn (Action, Buy, Clean-up), card types, how the game ends and scoring. Open it from the Home screen, the Lobby and the Board.
- [ ] **Tutorial tips:** short hints that point out key moments for first-time players, such as "Play your Treasures, then buy a card" or "Actions let you play more cards". They can be dismissed, a player can turn them off, and they stay off once dismissed.

### 5. Gameplay polish
Order these by playtest feedback.
- [ ] **Animations:**
  - cards moving between zones: drawing, playing, buying, discarding, trashing;
  - shuffling;
  - highlights when a turn passes and when a choice prompt opens;
  - support for reduced motion (`prefers-reduced-motion`).
- [ ] Show set-aside and revealed cards (Library, Sentry, Bandit). Today they vanish from view while the choice is open.
- [ ] **Sounds**, with a mute toggle and volume remembered per device:
  - drawing cards, playing a card, attacks, reactions (counters), game start, turn start, buying at the market, discarding;
  - your turn starting while the tab is in the background (plus a changing tab title);
  - a choice dialog opening, a shuffle, the timer's last-10-seconds tick.
- [x] Turn timer (host setting) with random auto-moves and a 30 s clock for attack responses.
- [ ] Add bots to fill empty seats or to practice solo. Build on the simple bot in `src/sim/bigMoney.ts`.
- [ ] Relay server, if playtests show connection failures: add a TURN server (free tier on Metered or Cloudflare) to the PeerJS config.

### Small known gaps
- [ ] The double-click guard can rarely let a second click through when another player's move arrives at the same instant.
- [ ] The choice dialog doesn't manage keyboard focus.
- [ ] Connections from refused players stay open until those players leave.

## Later

### 6. Bigger additions
- [ ] Custom cards. The engine already supports them as data plus a small effect function.
- [ ] A Tanto Cuore-style twist, such as a separate scoring area that opponents can attack.
- [ ] Expansion cards (Intrigue, Seaside and so on).
- [ ] Save and resume a game. This would need the card effects rewritten as steps that can be saved, instead of paused functions held in the host's memory.
- [ ] Hand hosting over to another player if the host leaves.

## References
- Design spec: `docs/superpowers/specs/2026-10-04-dominion-friends-design.md`
- Plan 1 (engine): `docs/superpowers/plans/2026-10-04-engine-and-cards.md`
- Plan 2 (networking and UI): `docs/superpowers/plans/2026-10-04-networking-and-ui.md`
- Playtest round 1 spec: `docs/superpowers/specs/2026-10-05-playtest-round-1-design.md`
- Playtest round 1 plan: `docs/superpowers/plans/2026-10-05-playtest-round-1.md`
