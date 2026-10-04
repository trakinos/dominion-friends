# Dominion Friends — Design Spec

**Date:** 2026-10-04
**Status:** Draft for review

## 1. Summary

A browser-based deck-building card game for 2–4 friends, using the Dominion (2nd edition) base-set rules. One player hosts the session from their browser; the others join with a room code over peer-to-peer WebRTC. No installs and no game server: the app is a static site.

The theme is undecided. v1 ships with placeholder card names and generated card frames. Theming is a data/style layer applied later without touching rules code.

## 2. Goals and non-goals

**Goals (v1)**
- Full base-set 2E rules, enforced by the engine, with all 26 kingdom cards.
- Host-in-browser multiplayer (2–4 players) via room code / share link.
- Lobby with kingdom picker (choose 10 or randomize).
- Game board with prompts for mid-effect choices, a game log, and an end screen.
- Guests can rejoin after refresh or disconnect.
- Engine fully covered by automated tests.

**Non-goals (v1)**
- Theme and card art.
- Bots as players. A Big Money bot exists only as a test harness.
- Save/resume, and host migration.
- TURN relay server.
- Expansions, custom cards, chat, sound.

## 3. Game rules (reference)

### 3.1 Setup
- Each player's starting deck is 7 Copper and 3 Estate, shuffled. Each player draws 5.
- The first player is random.
- Supply:

| Pile | Cost | Effect | Count |
|---|---|---|---|
| Copper | 0 | $1 | 60 − 7×players |
| Silver | 3 | $2 | 40 |
| Gold | 6 | $3 | 30 |
| Estate | 2 | 1 VP | 8 (2p) / 12 (3–4p) |
| Duchy | 5 | 3 VP | 8 / 12 |
| Province | 8 | 6 VP | 8 / 12 |
| Curse | 0 | −1 VP | 10 × (players − 1) |
| Kingdom ×10 | varies | see §3.4 | 10 each; Victory kingdom cards (Gardens) use 8 / 12 |

### 3.2 Turn
1. **Action phase:** start with 1 Action. Each Action card played costs 1 Action. +Actions add more. The player may end the phase at any time.
2. **Buy phase:** start with 1 Buy and $0. Play any number of Treasures, then buy cards one at a time, each costing 1 Buy. Bought cards go to the discard pile. Once a card is bought, no more Treasures may be played this turn (2E rule). Unspent $ is lost.
3. **Clean-up:** discard the hand and all cards in play, then draw 5. Reset Actions, Buys and $.

**Reshuffle:** whenever a player must draw or reveal from an empty deck, shuffle their discard pile to form a new deck. If both are empty, the draw does nothing.

### 3.3 Game end and scoring
- The game ends at the end of a turn in which the Province pile is empty, or any 3 or more Supply piles are empty. The Curse pile counts as a Supply pile.
- VP are counted over every card the player owns: deck, hand, discard and in play.
- Most VP wins. On a tie, the tied player with fewer turns wins. If they also had equal turns, they share the win.

### 3.4 Kingdom cards
Internal ids are the original card names, for clarity. Display names are generic placeholders until a theme is chosen.

| Id | Placeholder name | Cost | Types | Effect |
|---|---|---|---|---|
| cellar | Sift | 2 | Action | +1 Action. Discard any number of cards, then draw that many. |
| chapel | Purge | 2 | Action | Trash up to 4 cards from your hand. |
| moat | Shield | 2 | Action, Reaction | +2 Cards. Reaction: when another player plays an Attack, you may first reveal this from your hand to be unaffected by it. |
| harbinger | Recall | 3 | Action | +1 Card, +1 Action. Look through your discard pile. You may put a card from it onto your deck. |
| merchant | Trader | 3 | Action | +1 Card, +1 Action. The first time you play a Silver this turn, +$1. |
| vassal | Servant | 3 | Action | +$2. Discard the top card of your deck. If it's an Action card, you may play it (this costs no Action). |
| village | Village | 3 | Action | +1 Card, +2 Actions. |
| workshop | Workshop | 3 | Action | Gain a card costing up to $4. |
| bureaucrat | Clerk | 4 | Action, Attack | Gain a Silver onto your deck. Each other player reveals a Victory card from their hand and puts it onto their deck, or reveals a hand with no Victory cards. |
| gardens | Garden | 4 | Victory | Worth 1 VP per 10 cards you own (round down). |
| militia | Raiders | 4 | Action, Attack | +$2. Each other player discards down to 3 cards in hand. |
| moneylender | Lender | 4 | Action | You may trash a Copper from your hand for +$3. |
| poacher | Scavenger | 4 | Action | +1 Card, +1 Action, +$1. Discard a card per empty Supply pile. |
| remodel | Rebuild | 4 | Action | Trash a card from your hand. Gain a card costing up to $2 more than it. |
| smithy | Draw Three | 4 | Action | +3 Cards. |
| throne_room | Echo | 4 | Action | You may play an Action card from your hand twice. |
| bandit | Thief | 5 | Action, Attack | Gain a Gold. Each other player reveals the top 2 cards of their deck, trashes a revealed Treasure other than Copper, and discards the rest. |
| council_room | Council | 5 | Action | +4 Cards, +1 Buy. Each other player draws a card. |
| festival | Festival | 5 | Action | +2 Actions, +1 Buy, +$2. |
| laboratory | Lab | 5 | Action | +2 Cards, +1 Action. |
| library | Archive | 5 | Action | Draw until you have 7 cards in hand. You may set aside any Action cards drawn this way as you draw them. Discard the set-aside cards afterwards. |
| market | Market | 5 | Action | +1 Card, +1 Action, +1 Buy, +$1. |
| mine | Refinery | 5 | Action | You may trash a Treasure from your hand. Gain a Treasure to your hand costing up to $3 more than it. |
| sentry | Sentry | 5 | Action | +1 Card, +1 Action. Look at the top 2 cards of your deck. Trash and/or discard any number of them. Put the rest back on top in any order. |
| witch | Hex | 5 | Action, Attack | +2 Cards. Each other player gains a Curse. |
| artisan | Artisan | 6 | Action | Gain a card to your hand costing up to $5. Put a card from your hand onto your deck. |

**Rules details the engine must handle:**
- **Gain** takes a card from the Supply. If the pile is empty, nothing is gained. "Up to $X" choices only offer non-empty piles at that cost or less.
- **Attacks** resolve in turn order, starting with the player to the attacker's left. Before an Attack's effect resolves, each other player holding a Moat is prompted to reveal it. A revealed Moat makes that player unaffected.
- **Curses** are dealt in turn order. Witch gives nothing once the Curse pile is empty.
- **Throne Room on Throne Room:** choose an Action, play it twice, then choose a second Action and play that twice.
- **Vassal and Throne Room** play cards without using an Action. A card played this way still goes into the play area.
- **Merchant** checks "first Silver played this turn". Multiple Merchants each give +$1 on that first Silver.
- **Gardens** counts cards at game end.

## 4. Architecture

```
src/
  engine/   pure rules: state, intents, prompt handling, setup, scoring, end check, viewFor
  cards/    card definitions (data + effect generators) and the effect building blocks
  net/      PeerJS host/guest, message protocol, rejoin, transport interface
  ui/       React screens and components
  theme/    display names and styles (placeholder theme in v1)
```

Stack: Vite, React, TypeScript (strict), PeerJS, Vitest. Deployed as a static site (GitHub Pages).

**Dependency rule:** `engine` and `cards` import nothing from `net` or `ui`. `net` depends on `engine` types only. `ui` depends on `net` and `engine` types. Only the host instantiates the engine.

## 5. Engine

### 5.1 State
```ts
type CardId = string;            // e.g. 'smithy', 'copper'

interface PlayerState {
  id: string; name: string;
  deck: CardId[];                // index 0 = top
  hand: CardId[];
  discard: CardId[];
  inPlay: CardId[];
  turnsTaken: number;
}

interface GameState {
  players: PlayerState[];
  supply: Record<CardId, number>;
  kingdom: CardId[];             // the 10 chosen
  trash: CardId[];
  turn: {
    player: number; phase: 'action' | 'buy' | 'cleanup';
    actions: number; buys: number; coins: number;
    boughtThisTurn: boolean;     // locks further Treasure plays
    flags: Record<string, unknown>;   // per-turn effects, e.g. Merchant
  };
  pending: Prompt | null;
  log: LogEntry[];
  rng: RngState;                 // seeded, so tests are reproducible
  result: GameResult | null;
}
```

### 5.2 Intents
Players change state only through intents:
`playAction(handIndex)`, `playTreasure(handIndex)`, `playAllTreasures()`, `buy(cardId)`, `endPhase()`, `answerPrompt(answer)`.

`engine.apply(state, playerId, intent)` returns `{ ok: true }` or `{ ok: false, reason }`. Illegal intents leave state unchanged. Illegal includes: not your turn or prompt, wrong phase, no Actions or Buys left, can't afford, empty pile, Treasure played after buying, malformed answer, or any intent while a prompt is pending other than `answerPrompt` from the prompted player.

### 5.3 Card effects and prompts
Each card is data plus an optional effect generator:
```ts
interface CardDef {
  id: CardId; cost: number;
  types: ('action'|'treasure'|'victory'|'curse'|'attack'|'reaction')[];
  coins?: number;                         // treasures
  vp?: number | ((owned: CardId[]) => number);
  play?: (ctx: EffectContext) => Generator<Prompt, void, PromptAnswer>;
}
```
`EffectContext` provides the building blocks: `draw`, `gain(card, to: 'discard'|'hand'|'deck')`, `trash`, `discard`, `reveal`, `topdeck`, `addActions`, `addBuys`, `addCoins`, `attackedOpponents()` (handles Moat prompts), `emptySupplyPiles()`, `playCard(card)` (for Throne Room and Vassal), and `prompt(player, spec)`.

Prompt kinds, enough for all 26 cards:
- `chooseCards`: from hand, discard pile or revealed cards, with `min` and `max` and an optional filter (type, max cost).
- `chooseSupply`: a pile, filtered by max cost and type.
- `chooseOption`: for example yes/no, or "trash / discard / keep".
- `orderCards`: Sentry putting cards back.

When an effect yields a prompt, the engine stores it in `state.pending` and keeps the generator in a host-memory map, outside `GameState`. `answerPrompt` validates the answer against the prompt spec and resumes the generator. A card's effect is finished when its generator returns.

**Trade-off:** generators can't be serialized, so a game can't be saved mid-effect. This is acceptable because the host leaving already ends the game.

### 5.4 Views
`viewFor(state, playerId)` returns:
- full supply, trash, turn info, log and the current prompt (who it's for and its spec);
- your own hand, plus counts of your deck and discard and the top card of your discard;
- for opponents: hand, deck and discard counts, top card of discard, cards in play;
- prompt details that include private cards (for example Sentry's look) only to the prompted player.

The log contains public information only.

## 6. Networking

### 6.1 Rooms
- The host clicks **Host game** and creates a PeerJS peer with ID `dmf-<code>`, where `<code>` is 4 characters from an unambiguous alphabet. The share link is `<site>/#join=<code>`.
- A guest opens a data connection to `dmf-<code>`. The public PeerJS broker is used for signaling only.

### 6.2 Protocol
JSON messages, each with a `type` field:
```
guest → host:  hello{name, token?} | intent{intent} | ping
host → guest:  welcome{playerId, token} | lobby{players, kingdom, settings}
               | view{view} | error{reason} | ended{result}
```
- The host validates every message against its expected shape and drops anything malformed.
- After every state change, the host sends a fresh full `view` to each connected player.
- The host's own UI uses the same intent and view path through an in-process transport.
- The `Transport` interface hides the difference between PeerJS and in-memory transports, which keeps tests independent of the network.

### 6.3 Seats and rejoin
- On the first `hello`, the host assigns a seat and a random `token`. The guest stores the token in `localStorage`, keyed by room code.
- A `hello` with a known token reclaims that seat and gets the current lobby or view. Duplicate connections for the same token replace the older one.
- Once a game has started, a `hello` with no token or an unknown token gets `error{reason: 'game in progress'}`.
- Disconnected seats are shown as offline. When the game is waiting on an offline player, everyone sees "Waiting for X…". There is no timeout in v1.
- If the host disconnects, guests see "Host disconnected — game over".

### 6.4 Errors
- Broker unreachable: show an error with a Retry button.
- Room not found or connection failed: tell the guest the code may be wrong, or that their network blocks peer connections.
- Room full (4 players): `error{reason: 'room full'}`.

## 7. UI

### 7.1 Screens
1. **Home:** name input, **Host game**, and **Join** with a code. The code is pre-filled from `#join=`.
2. **Lobby:** seat list with online dots, share link with a copy button. The host also sees the kingdom picker: all 26 cards, choose exactly 10, a Randomize button, and Start (enabled with 2–4 players and 10 cards chosen). Guests see the kingdom update live.
3. **Game board:**
   - Supply: kingdom piles plus base piles, each with cost and remaining count. Piles you can afford are highlighted during your Buy phase.
   - Opponents strip: name, online dot, hand, deck and discard counts.
   - Play area: cards in play this turn.
   - Turn bar: phase, Actions, Buys, $, **Play all treasures** and **End phase** buttons.
   - Your hand: playable cards highlighted. Clicking a card plays it.
   - Your deck count and discard pile (top card and count).
   - Log: scrolling, newest at the bottom.
   - **Prompt panel:** a modal when a prompt is waiting on you. It shows the instruction, lets you select only legal choices, and confirms when the selection is valid. Other players see a "Waiting for X: <prompt>" banner.
4. **End screen:** each player's VP with a breakdown by card, the winner(s), **Play again (same kingdom)** and **Back to lobby** (host only, guests follow).

### 7.2 Cards and theming
A card is drawn as a frame: name, a type color band (Action, Treasure, Victory, Curse, Attack, Reaction), cost, and rule text from the card data. There is no art in v1. The `theme/` module maps `CardId` to `{ name, text?, art? }` plus CSS variables. v1 ships the placeholder theme from §3.4.

### 7.3 Responsive layout
Desktop first. Below 768px the hand scrolls horizontally, and Supply and Log move into tabs.

## 8. Testing

- **Card tests (Vitest):** each of the 26 cards gets at least one scripted test: seed a state, apply intents, answer prompts, assert the result.
- **Interaction tests:** Throne Room ×2, Throne Room + Militia, Moat vs Militia/Witch/Bandit/Bureaucrat, Library skipping Actions, Sentry ordering, Witch with an empty Curse pile, Vassal hitting an Action, Merchant + several Silvers, Poacher with empty piles, gaining from an empty pile.
- **Rules tests:** setup counts for 2, 3 and 4 players; reshuffle; both end conditions; tie-break; Treasure lock after buying; rejection of every illegal intent category.
- **Simulated games:** a Big Money bot plays 200 seeded games over random kingdoms with 2–4 players. Assertions: every game finishes, and the total card count (all zones, supply and trash) stays constant.
- **Network tests:** host and guest logic over an in-memory transport: join, lobby, start, intent → view, a malformed message is dropped, rejoin with a token, refusal of a new guest mid-game.
- **Manual check:** real WebRTC with two browsers, on the same machine and across devices.

## 9. Future (not v1)
Theme and art; bots as opponents; save/resume (would need the generators replaced by serializable effect steps); host migration; a TURN relay; custom cards and expansions; chat; sound.
