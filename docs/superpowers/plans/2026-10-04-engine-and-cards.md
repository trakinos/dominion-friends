# Dominion Friends — Plan 1: Rules Engine & Cards

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete, headless Dominion base-set (2E) rules engine with all 26 kingdom cards, fully covered by Vitest tests, including 200 simulated bot games.

**Architecture:** Game state is a plain object. Only the host instantiates the engine. A `Game` class owns the state and applies validated intents. Card effects are generator functions that `yield` prompts when a player must choose. The `Game` keeps the paused generator in memory and resumes it when a valid answer arrives. Cards depend only on an `EffectContext` interface. `viewFor` produces each player's filtered view. No UI or network code in this plan.

**Tech Stack:** TypeScript (strict), Vitest, Node 20+. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-04-dominion-friends-design.md`

## Global Constraints

- Rules are Dominion **2nd edition** base set (spec §3). Card ids are the original card names in snake_case (`throne_room`, `council_room`).
- `engine/` and `cards/` must not import from `net/` or `ui/`. Card effect files import **types only**; all runtime behavior goes through `EffectContext`.
- Deck arrays: `deck[0]` is the top card. Discard arrays: the last element is the top card.
- Illegal intents return `{ ok: false, reason }` and leave state unchanged.
- Shuffles use the seeded RNG in state; never `Math.random()` inside `engine/` or `cards/`.
- Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (use a second `-m`).
- Verification command after every task: `npm test && npm run typecheck`, both must pass.

## File Map

```
package.json, tsconfig.json, vitest.config.ts, .gitignore
src/engine/
  rng.ts          seeded RNG (mulberry32) + shuffle
  types.ts        GameState, PlayerState, TurnState, Prompt, PromptAnswer, Intent, LogEntry, results
  zones.ts        drawing, reshuffling, owned cards, empty pile count
  setup.ts        createGame, freshTurn
  scoring.ts      scorePlayer, isGameOver, computeResult
  prompts.ts      validateAnswer
  context.ts      createContext: the EffectContext implementation
  game.ts         Game class: intents, turn flow, effect driving
  view.ts         viewFor
  testkit.ts      test helpers (newState, setZones, answer builders)
src/cards/
  types.ts        CardData, CardDef, Effect, Gen, EffectContext interface
  data.ts         all 33 card definitions (data only)
  registry.ts     getCard, isType, cardVp, KINGDOM_IDS
  effects/index.ts      merges effect groups
  effects/simple.ts     village, smithy, laboratory, festival, market, chapel
  effects/hand.ts       cellar, moat, merchant, council_room, moneylender, poacher, workshop, harbinger, vassal
  effects/transform.ts  remodel, mine, artisan, throne_room
  effects/attacks.ts    militia, witch, bandit, bureaucrat
  effects/look.ts       library, sentry
src/sim/
  bigMoney.ts     simple bot used by the simulation test
```

Tests live next to the code as `*.test.ts`.

---

### Task 1: Project scaffold, RNG, core types, card data and registry

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/engine/rng.ts`, `src/engine/types.ts`
- Create: `src/cards/types.ts`, `src/cards/data.ts`, `src/cards/registry.ts`, `src/cards/effects/index.ts`
- Test: `src/engine/rng.test.ts`, `src/cards/registry.test.ts`

**Interfaces:**
- Produces: `createRng(seed): RngState`, `nextFloat(rng)`, `nextInt(rng, n)`, `shuffle(rng, items)`. All types in `engine/types.ts`. `CardData`, `CardDef`, `Effect`, `Gen<T>`, `EffectContext` in `cards/types.ts`. `getCard(id)`, `isType(id, type)`, `cardVp(id, owned)`, `KINGDOM_IDS`, `BASIC_IDS` in `cards/registry.ts`. `EFFECTS` in `cards/effects/index.ts`.

- [ ] **Step 1: Create the project files**

`package.json`:
```json
{
  "name": "dominion-friends",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": []
  },
  "include": ["src"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
```

`.gitignore`:
```
node_modules
dist
```

Run: `npm install -D typescript vitest`
Expected: installs without errors; `package.json` gains `devDependencies`.

- [ ] **Step 2: Write the failing RNG test**

`src/engine/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createRng, nextFloat, nextInt, shuffle } from './rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [nextFloat(a), nextFloat(a), nextFloat(a)];
    const seqB = [nextFloat(b), nextFloat(b), nextFloat(b)];
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds', () => {
    expect(nextFloat(createRng(1))).not.toEqual(nextFloat(createRng(2)));
  });

  it('returns floats in [0, 1) and ints in [0, n)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const f = nextFloat(rng);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = nextInt(rng, 5);
      expect(Number.isInteger(n) && n >= 0 && n < 5).toBe(true);
    }
  });

  it('shuffles into a permutation without mutating the input', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    const out = shuffle(createRng(3), input);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect([...out].sort()).toEqual(input);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: FAIL, cannot resolve `./rng`.

- [ ] **Step 4: Implement the RNG**

`src/engine/rng.ts`:
```ts
/** Seeded PRNG state. Stored inside GameState so shuffles are reproducible. */
export interface RngState {
  s: number;
}

export function createRng(seed: number): RngState {
  return { s: seed >>> 0 };
}

/** mulberry32 */
export function nextFloat(rng: RngState): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(rng: RngState, n: number): number {
  return Math.floor(nextFloat(rng) * n);
}

/** Fisher–Yates; returns a new array. */
export function shuffle<T>(rng: RngState, items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

- [ ] **Step 5: Run the RNG test**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the core types**

`src/engine/types.ts`:
```ts
import type { RngState } from './rng';

export type CardId = string;
export type CardType = 'action' | 'treasure' | 'victory' | 'curse' | 'attack' | 'reaction';
export type Phase = 'action' | 'buy';

export interface PlayerState {
  id: string;
  name: string;
  /** deck[0] is the top card. */
  deck: CardId[];
  hand: CardId[];
  /** The last element is the top card. */
  discard: CardId[];
  inPlay: CardId[];
  turnsTaken: number;
}

export interface TurnState {
  player: number;
  phase: Phase;
  actions: number;
  buys: number;
  coins: number;
  /** Once true, no more Treasures may be played this turn. */
  boughtThisTurn: boolean;
  /** Merchants played this turn; each adds +$1 to the first Silver. */
  merchants: number;
  silverPlayed: boolean;
}

export type Prompt =
  | {
      kind: 'chooseCards';
      player: number;
      message: string;
      cards: CardId[];
      /** Indices into `cards` that may be chosen. */
      selectable: number[];
      min: number;
      max: number;
    }
  | { kind: 'chooseSupply'; player: number; message: string; piles: CardId[]; optional: boolean }
  | { kind: 'chooseOption'; player: number; message: string; options: string[]; cards?: CardId[] }
  | { kind: 'orderCards'; player: number; message: string; cards: CardId[] };

export type PromptAnswer =
  | { kind: 'cards'; indices: number[] }
  | { kind: 'supply'; card: CardId | null }
  | { kind: 'option'; index: number }
  /** order[k] is an index into the prompt's cards; the first entry ends on top. */
  | { kind: 'order'; order: number[] };

export type Intent =
  | { type: 'playAction'; handIndex: number }
  | { type: 'playTreasure'; handIndex: number }
  | { type: 'playAllTreasures' }
  | { type: 'buy'; card: CardId }
  | { type: 'endPhase' }
  | { type: 'answerPrompt'; answer: PromptAnswer };

export type ApplyResult = { ok: true } | { ok: false; reason: string };

/** Public log line. The UI renders `text` followed by the card names. */
export interface LogEntry {
  player: number | null;
  text: string;
  cards?: CardId[];
}

export interface PlayerScore {
  playerId: string;
  name: string;
  vp: number;
  turns: number;
  breakdown: Record<CardId, { count: number; vp: number }>;
}

export interface GameResult {
  scores: PlayerScore[];
  winners: string[];
}

export interface GameState {
  players: PlayerState[];
  supply: Record<CardId, number>;
  kingdom: CardId[];
  trash: CardId[];
  turn: TurnState;
  pending: Prompt | null;
  log: LogEntry[];
  rng: RngState;
  result: GameResult | null;
}
```

- [ ] **Step 7: Write the card types and the EffectContext interface**

`src/cards/types.ts`:
```ts
import type { CardId, CardType, GameState, Prompt, PromptAnswer } from '../engine/types';

export type Gen<T = void> = Generator<Prompt, T, PromptAnswer>;
export type Effect = (ctx: EffectContext) => Gen;

export interface CardData {
  id: CardId;
  cost: number;
  types: CardType[];
  /** Rule text shown on the card. */
  text: string;
  coins?: number;
  vp?: number | ((owned: CardId[]) => number);
}

export interface CardDef extends CardData {
  play?: Effect;
}

export interface ChooseFromHandOptions {
  min: number;
  max: number;
  message: string;
  filter?: (card: CardId) => boolean;
}

export interface ChooseCardsOptions {
  min: number;
  max: number;
  message: string;
  /** Defaults to every index. */
  selectable?: number[];
}

export interface ChooseSupplyOptions {
  maxCost: number;
  message: string;
  optional?: boolean;
  type?: CardType;
}

/**
 * Everything a card effect may do. Card files import this as a type only;
 * the engine supplies the implementation (engine/context.ts).
 */
export interface EffectContext {
  /** Index of the player whose card is resolving. */
  readonly me: number;
  readonly state: GameState;
  /** Other players in turn order, starting at my left. */
  opponents(): number[];
  cost(card: CardId): number;
  isType(card: CardId, type: CardType): boolean;
  draw(player: number, n: number): CardId[];
  addActions(n: number): void;
  addBuys(n: number): void;
  addCoins(n: number): void;
  /** Gains from the Supply. Returns false if the pile is empty. */
  gain(player: number, card: CardId, to?: 'discard' | 'hand' | 'deck'): boolean;
  trashFromHand(player: number, handIndices: number[]): CardId[];
  discardFromHand(player: number, handIndices: number[]): CardId[];
  topdeckFromHand(player: number, handIndex: number): CardId;
  /** Removes up to n cards from the top of the deck, reshuffling if needed. */
  takeFromDeck(player: number, n: number): CardId[];
  /** cards[0] ends on top. */
  putOnDeck(player: number, cards: CardId[]): void;
  discardCards(player: number, cards: CardId[]): void;
  trashCards(player: number, cards: CardId[]): void;
  emptySupplyPiles(): number;
  log(player: number | null, text: string, cards?: CardId[]): void;
  /** Returns chosen hand indices. Skips the prompt when nothing or everything must be chosen. */
  chooseFromHand(player: number, opts: ChooseFromHandOptions): Gen<number[]>;
  /** Returns chosen indices into `cards`. Same skipping rules as chooseFromHand. */
  chooseCards(player: number, cards: CardId[], opts: ChooseCardsOptions): Gen<number[]>;
  /** Returns null when no pile qualifies, or when optional and declined. */
  chooseSupply(player: number, opts: ChooseSupplyOptions): Gen<CardId | null>;
  chooseOption(player: number, message: string, options: string[], cards?: CardId[]): Gen<number>;
  /** Returns the cards in the chosen order (first = top). No prompt for 0–1 cards. */
  orderCards(player: number, cards: CardId[], message: string): Gen<CardId[]>;
  /** Asks Moat holders whether to reveal; returns the opponents the attack hits, in turn order. */
  attackedOpponents(): Gen<number[]>;
  /** Resolves a card's effect. The caller is responsible for moving the card into play. */
  playCard(card: CardId): Gen;
}
```

- [ ] **Step 8: Write the failing registry test**

`src/cards/registry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { BASIC_IDS, KINGDOM_IDS, cardVp, getCard, isType } from './registry';

describe('card registry', () => {
  it('has the 7 basic cards and 26 unique kingdom cards', () => {
    expect(BASIC_IDS).toEqual(['copper', 'silver', 'gold', 'estate', 'duchy', 'province', 'curse']);
    expect(KINGDOM_IDS).toHaveLength(26);
    expect(new Set(KINGDOM_IDS).size).toBe(26);
  });

  it('looks up cards by id', () => {
    expect(getCard('smithy')).toMatchObject({ id: 'smithy', cost: 4, types: ['action'] });
    expect(getCard('gold').coins).toBe(3);
    expect(() => getCard('nope')).toThrow('Unknown card: nope');
  });

  it('checks types', () => {
    expect(isType('moat', 'reaction')).toBe(true);
    expect(isType('witch', 'attack')).toBe(true);
    expect(isType('copper', 'action')).toBe(false);
  });

  it('computes victory points', () => {
    expect(cardVp('province', [])).toBe(6);
    expect(cardVp('curse', [])).toBe(-1);
    expect(cardVp('copper', [])).toBe(0);
    expect(cardVp('gardens', Array(25).fill('copper'))).toBe(2);
  });
});
```

- [ ] **Step 9: Run test to verify it fails**

Run: `npx vitest run src/cards/registry.test.ts`
Expected: FAIL, cannot resolve `./registry`.

- [ ] **Step 10: Write the card data**

`src/cards/data.ts`:
```ts
import type { CardData } from './types';

export const BASIC_CARDS: CardData[] = [
  { id: 'copper', cost: 0, types: ['treasure'], coins: 1, text: '$1' },
  { id: 'silver', cost: 3, types: ['treasure'], coins: 2, text: '$2' },
  { id: 'gold', cost: 6, types: ['treasure'], coins: 3, text: '$3' },
  { id: 'estate', cost: 2, types: ['victory'], vp: 1, text: '1 VP' },
  { id: 'duchy', cost: 5, types: ['victory'], vp: 3, text: '3 VP' },
  { id: 'province', cost: 8, types: ['victory'], vp: 6, text: '6 VP' },
  { id: 'curse', cost: 0, types: ['curse'], vp: -1, text: '-1 VP' },
];

export const KINGDOM_CARDS: CardData[] = [
  { id: 'cellar', cost: 2, types: ['action'], text: '+1 Action. Discard any number of cards, then draw that many.' },
  { id: 'chapel', cost: 2, types: ['action'], text: 'Trash up to 4 cards from your hand.' },
  { id: 'moat', cost: 2, types: ['action', 'reaction'], text: '+2 Cards. When another player plays an Attack, you may first reveal this from your hand to be unaffected by it.' },
  { id: 'harbinger', cost: 3, types: ['action'], text: '+1 Card, +1 Action. Look through your discard pile. You may put a card from it onto your deck.' },
  { id: 'merchant', cost: 3, types: ['action'], text: '+1 Card, +1 Action. The first time you play a Silver this turn, +$1.' },
  { id: 'vassal', cost: 3, types: ['action'], text: "+$2. Discard the top card of your deck. If it's an Action card, you may play it." },
  { id: 'village', cost: 3, types: ['action'], text: '+1 Card, +2 Actions.' },
  { id: 'workshop', cost: 3, types: ['action'], text: 'Gain a card costing up to $4.' },
  { id: 'bureaucrat', cost: 4, types: ['action', 'attack'], text: 'Gain a Silver onto your deck. Each other player reveals a Victory card from their hand and puts it onto their deck (or reveals a hand with no Victory cards).' },
  { id: 'gardens', cost: 4, types: ['victory'], vp: (owned) => Math.floor(owned.length / 10), text: 'Worth 1 VP per 10 cards you have (round down).' },
  { id: 'militia', cost: 4, types: ['action', 'attack'], text: '+$2. Each other player discards down to 3 cards in hand.' },
  { id: 'moneylender', cost: 4, types: ['action'], text: 'You may trash a Copper from your hand for +$3.' },
  { id: 'poacher', cost: 4, types: ['action'], text: '+1 Card, +1 Action, +$1. Discard a card per empty Supply pile.' },
  { id: 'remodel', cost: 4, types: ['action'], text: 'Trash a card from your hand. Gain a card costing up to $2 more than it.' },
  { id: 'smithy', cost: 4, types: ['action'], text: '+3 Cards.' },
  { id: 'throne_room', cost: 4, types: ['action'], text: 'You may play an Action card from your hand twice.' },
  { id: 'bandit', cost: 5, types: ['action', 'attack'], text: 'Gain a Gold. Each other player reveals the top 2 cards of their deck, trashes a revealed Treasure other than Copper, and discards the rest.' },
  { id: 'council_room', cost: 5, types: ['action'], text: '+4 Cards, +1 Buy. Each other player draws a card.' },
  { id: 'festival', cost: 5, types: ['action'], text: '+2 Actions, +1 Buy, +$2.' },
  { id: 'laboratory', cost: 5, types: ['action'], text: '+2 Cards, +1 Action.' },
  { id: 'library', cost: 5, types: ['action'], text: 'Draw until you have 7 cards in hand, skipping any Action cards you choose to; set those aside, discarding them afterwards.' },
  { id: 'market', cost: 5, types: ['action'], text: '+1 Card, +1 Action, +1 Buy, +$1.' },
  { id: 'mine', cost: 5, types: ['action'], text: 'You may trash a Treasure from your hand. Gain a Treasure to your hand costing up to $3 more than it.' },
  { id: 'sentry', cost: 5, types: ['action'], text: '+1 Card, +1 Action. Look at the top 2 cards of your deck. Trash and/or discard any number of them. Put the rest back on top in any order.' },
  { id: 'witch', cost: 5, types: ['action', 'attack'], text: '+2 Cards. Each other player gains a Curse.' },
  { id: 'artisan', cost: 6, types: ['action'], text: 'Gain a card to your hand costing up to $5. Put a card from your hand onto your deck.' },
];
```

- [ ] **Step 11: Write the empty effects index and the registry**

`src/cards/effects/index.ts`:
```ts
import type { CardId } from '../../engine/types';
import type { Effect } from '../types';

export const EFFECTS: Record<CardId, Effect> = {};
```

`src/cards/registry.ts`:
```ts
import type { CardId, CardType } from '../engine/types';
import { BASIC_CARDS, KINGDOM_CARDS } from './data';
import { EFFECTS } from './effects';
import type { CardDef } from './types';

const CARDS = new Map<CardId, CardDef>();
for (const data of [...BASIC_CARDS, ...KINGDOM_CARDS]) {
  CARDS.set(data.id, { ...data, play: EFFECTS[data.id] });
}

export const BASIC_IDS: CardId[] = BASIC_CARDS.map((c) => c.id);
export const KINGDOM_IDS: CardId[] = KINGDOM_CARDS.map((c) => c.id);

export function getCard(id: CardId): CardDef {
  const card = CARDS.get(id);
  if (!card) throw new Error(`Unknown card: ${id}`);
  return card;
}

export function isType(id: CardId, type: CardType): boolean {
  return getCard(id).types.includes(type);
}

export function cardVp(id: CardId, owned: CardId[]): number {
  const vp = getCard(id).vp;
  return typeof vp === 'function' ? vp(owned) : (vp ?? 0);
}
```

- [ ] **Step 12: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS (8 tests), typecheck clean.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src
git commit -m "feat: scaffold project with RNG, core types and card data" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Zones, game setup and scoring

**Files:**
- Create: `src/engine/zones.ts`, `src/engine/setup.ts`, `src/engine/scoring.ts`, `src/engine/testkit.ts`
- Test: `src/engine/zones.test.ts`, `src/engine/setup.test.ts`, `src/engine/scoring.test.ts`

**Interfaces:**
- Consumes: `shuffle`, `createRng`, `nextInt` (Task 1); `getCard`, `isType`, `cardVp`, `KINGDOM_IDS` (Task 1); types.
- Produces:
  - `zones.ts`: `takeTop(state, player): CardId | undefined`, `drawCards(state, player, n): CardId[]`, `ownedCards(p: PlayerState): CardId[]`, `emptyPileCount(state): number`
  - `setup.ts`: `interface SetupOptions { players: { id: string; name: string }[]; kingdom: CardId[]; seed: number }`, `createGame(opts): GameState`, `freshTurn(player: number): TurnState`
  - `scoring.ts`: `scorePlayer(p): PlayerScore`, `isGameOver(state): boolean`, `computeResult(state): GameResult`
  - `testkit.ts`: `TEST_KINGDOM`, `newState(opts?)` (player 0 to move, empty log), `setZones(state, player, zones)`, `answerCards(indices)`, `answerSupply(card)`, `answerOption(index)`, `answerOrder(order)` (each returns an `answerPrompt` Intent)

- [ ] **Step 1: Write the failing zones test**

`src/engine/zones.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { drawCards, emptyPileCount } from './zones';
import { newState, setZones } from './testkit';

describe('zones', () => {
  it('draws from the top of the deck', () => {
    const s = newState();
    setZones(s, 0, { deck: ['gold', 'silver', 'copper'], hand: [], discard: [] });
    expect(drawCards(s, 0, 2)).toEqual(['gold', 'silver']);
    expect(s.players[0].hand).toEqual(['gold', 'silver']);
    expect(s.players[0].deck).toEqual(['copper']);
  });

  it('reshuffles the discard pile when the deck runs out', () => {
    const s = newState();
    setZones(s, 0, { deck: ['gold'], hand: [], discard: ['silver', 'silver'] });
    expect(drawCards(s, 0, 3)).toEqual(['gold', 'silver', 'silver']);
    expect(s.players[0].discard).toEqual([]);
    expect(s.players[0].deck).toEqual([]);
  });

  it('stops drawing when deck and discard are both empty', () => {
    const s = newState();
    setZones(s, 0, { deck: ['gold'], hand: [], discard: [] });
    expect(drawCards(s, 0, 3)).toEqual(['gold']);
  });

  it('counts empty supply piles', () => {
    const s = newState();
    expect(emptyPileCount(s)).toBe(0);
    s.supply.village = 0;
    s.supply.smithy = 0;
    expect(emptyPileCount(s)).toBe(2);
  });
});
```

- [ ] **Step 2: Write the failing setup test**

`src/engine/setup.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createGame } from './setup';
import { TEST_KINGDOM } from './testkit';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

describe('createGame', () => {
  it('builds the 2-player supply', () => {
    const s = createGame({ players: players(2), kingdom: TEST_KINGDOM, seed: 1 });
    expect(s.supply).toMatchObject({
      copper: 46, silver: 40, gold: 30, estate: 8, duchy: 8, province: 8, curse: 10, village: 10, smithy: 10,
    });
    expect(Object.keys(s.supply)).toHaveLength(17);
  });

  it('builds the 4-player supply', () => {
    const s = createGame({ players: players(4), kingdom: TEST_KINGDOM, seed: 1 });
    expect(s.supply).toMatchObject({ copper: 32, estate: 12, duchy: 12, province: 12, curse: 30 });
  });

  it('uses 8 or 12 cards for Victory kingdom piles', () => {
    const kingdom = [...TEST_KINGDOM.slice(0, 9), 'gardens'];
    expect(createGame({ players: players(2), kingdom, seed: 1 }).supply.gardens).toBe(8);
    expect(createGame({ players: players(3), kingdom, seed: 1 }).supply.gardens).toBe(12);
  });

  it('deals 7 Copper and 3 Estate with 5 cards in hand', () => {
    const s = createGame({ players: players(3), kingdom: TEST_KINGDOM, seed: 5 });
    for (const p of s.players) {
      expect(p.hand).toHaveLength(5);
      expect(p.deck).toHaveLength(5);
      const all = [...p.hand, ...p.deck];
      expect(all.filter((c) => c === 'copper')).toHaveLength(7);
      expect(all.filter((c) => c === 'estate')).toHaveLength(3);
    }
    expect(s.turn).toMatchObject({ phase: 'action', actions: 1, buys: 1, coins: 0 });
    expect(s.turn.player).toBeGreaterThanOrEqual(0);
    expect(s.turn.player).toBeLessThan(3);
  });

  it('is deterministic for a seed', () => {
    const a = createGame({ players: players(2), kingdom: TEST_KINGDOM, seed: 7 });
    const b = createGame({ players: players(2), kingdom: TEST_KINGDOM, seed: 7 });
    expect(a).toEqual(b);
  });

  it('rejects bad options', () => {
    expect(() => createGame({ players: players(1), kingdom: TEST_KINGDOM, seed: 1 })).toThrow('Need 2-4 players');
    expect(() => createGame({ players: players(5), kingdom: TEST_KINGDOM, seed: 1 })).toThrow('Need 2-4 players');
    expect(() => createGame({ players: players(2), kingdom: TEST_KINGDOM.slice(0, 9), seed: 1 })).toThrow('Kingdom must have 10 different cards');
    expect(() => createGame({ players: players(2), kingdom: [...TEST_KINGDOM.slice(0, 9), 'cellar'], seed: 1 })).toThrow('Kingdom must have 10 different cards');
    expect(() => createGame({ players: players(2), kingdom: [...TEST_KINGDOM.slice(0, 9), 'copper'], seed: 1 })).toThrow('Not a kingdom card: copper');
  });
});
```

- [ ] **Step 3: Write the failing scoring test**

`src/engine/scoring.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeResult, isGameOver, scorePlayer } from './scoring';
import { newState, setZones } from './testkit';

describe('scoring', () => {
  it('counts VP across every zone with a breakdown', () => {
    const s = newState();
    setZones(s, 0, { deck: ['estate', 'duchy'], hand: ['province', 'curse', 'copper'], discard: ['estate'], inPlay: [] });
    const score = scorePlayer(s.players[0]);
    expect(score.vp).toBe(1 + 3 + 6 - 1 + 1);
    expect(score.breakdown.estate).toEqual({ count: 2, vp: 2 });
    expect(score.breakdown.curse).toEqual({ count: 1, vp: -1 });
    expect(score.breakdown.copper).toBeUndefined();
  });

  it('scores Gardens by deck size', () => {
    const s = newState();
    setZones(s, 0, { deck: Array(20).fill('copper'), hand: ['gardens', 'gardens'], discard: [], inPlay: [] });
    expect(scorePlayer(s.players[0]).vp).toBe(4);
  });

  it('detects the end of the game', () => {
    const s = newState();
    expect(isGameOver(s)).toBe(false);
    s.supply.village = 0;
    s.supply.smithy = 0;
    expect(isGameOver(s)).toBe(false);
    s.supply.curse = 0;
    expect(isGameOver(s)).toBe(true);
    const t = newState();
    t.supply.province = 0;
    expect(isGameOver(t)).toBe(true);
  });

  it('picks winners by VP, then fewer turns, else shared', () => {
    const s = newState();
    setZones(s, 0, { deck: ['province'], hand: [], discard: [], inPlay: [] });
    setZones(s, 1, { deck: ['duchy'], hand: [], discard: [], inPlay: [] });
    expect(computeResult(s).winners).toEqual(['p0']);

    setZones(s, 1, { deck: ['province'], hand: [], discard: [], inPlay: [] });
    s.players[0].turnsTaken = 2;
    s.players[1].turnsTaken = 1;
    expect(computeResult(s).winners).toEqual(['p1']);

    s.players[1].turnsTaken = 2;
    expect(computeResult(s).winners).toEqual(['p0', 'p1']);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/engine`
Expected: FAIL, cannot resolve `./zones`, `./setup`, `./scoring`, `./testkit`.

- [ ] **Step 5: Implement zones**

`src/engine/zones.ts`:
```ts
import { shuffle } from './rng';
import type { CardId, GameState, PlayerState } from './types';

/** Removes the top card of a deck, shuffling the discard pile in if the deck is empty. */
export function takeTop(state: GameState, player: number): CardId | undefined {
  const p = state.players[player];
  if (p.deck.length === 0) {
    if (p.discard.length === 0) return undefined;
    p.deck = shuffle(state.rng, p.discard);
    p.discard = [];
  }
  return p.deck.shift();
}

export function drawCards(state: GameState, player: number, n: number): CardId[] {
  const drawn: CardId[] = [];
  for (let i = 0; i < n; i++) {
    const card = takeTop(state, player);
    if (card === undefined) break;
    state.players[player].hand.push(card);
    drawn.push(card);
  }
  return drawn;
}

export function ownedCards(p: PlayerState): CardId[] {
  return [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
}

export function emptyPileCount(state: GameState): number {
  return Object.values(state.supply).filter((n) => n === 0).length;
}
```

- [ ] **Step 6: Implement setup**

`src/engine/setup.ts`:
```ts
import { isType, KINGDOM_IDS } from '../cards/registry';
import { createRng, nextInt, shuffle } from './rng';
import type { CardId, GameState, PlayerState, TurnState } from './types';
import { drawCards } from './zones';

export interface SetupOptions {
  players: { id: string; name: string }[];
  kingdom: CardId[];
  seed: number;
}

export function freshTurn(player: number): TurnState {
  return {
    player,
    phase: 'action',
    actions: 1,
    buys: 1,
    coins: 0,
    boughtThisTurn: false,
    merchants: 0,
    silverPlayed: false,
  };
}

export function createGame(opts: SetupOptions): GameState {
  const n = opts.players.length;
  if (n < 2 || n > 4) throw new Error('Need 2-4 players');
  const kingdom = [...new Set(opts.kingdom)];
  if (opts.kingdom.length !== 10 || kingdom.length !== 10) throw new Error('Kingdom must have 10 different cards');
  for (const id of kingdom) {
    if (!KINGDOM_IDS.includes(id)) throw new Error(`Not a kingdom card: ${id}`);
  }

  const rng = createRng(opts.seed);
  const victoryCount = n === 2 ? 8 : 12;
  const supply: Record<CardId, number> = {
    copper: 60 - 7 * n,
    silver: 40,
    gold: 30,
    estate: victoryCount,
    duchy: victoryCount,
    province: victoryCount,
    curse: 10 * (n - 1),
  };
  for (const id of kingdom) supply[id] = isType(id, 'victory') ? victoryCount : 10;

  const starting: CardId[] = [...Array(7).fill('copper'), ...Array(3).fill('estate')];
  const players: PlayerState[] = opts.players.map((p) => ({
    id: p.id,
    name: p.name,
    deck: shuffle(rng, starting),
    hand: [],
    discard: [],
    inPlay: [],
    turnsTaken: 0,
  }));

  const state: GameState = {
    players,
    supply,
    kingdom,
    trash: [],
    turn: freshTurn(nextInt(rng, n)),
    pending: null,
    log: [],
    rng,
    result: null,
  };
  for (let i = 0; i < n; i++) drawCards(state, i, 5);
  state.log.push({ player: state.turn.player, text: 'takes the first turn' });
  return state;
}
```

- [ ] **Step 7: Implement scoring**

`src/engine/scoring.ts`:
```ts
import { cardVp, getCard } from '../cards/registry';
import type { CardId, GameResult, GameState, PlayerScore, PlayerState } from './types';
import { emptyPileCount, ownedCards } from './zones';

export function scorePlayer(p: PlayerState): PlayerScore {
  const owned = ownedCards(p);
  const breakdown: Record<CardId, { count: number; vp: number }> = {};
  let vp = 0;
  for (const id of owned) {
    if (getCard(id).vp === undefined) continue;
    const value = cardVp(id, owned);
    const row = breakdown[id] ?? (breakdown[id] = { count: 0, vp: 0 });
    row.count++;
    row.vp += value;
    vp += value;
  }
  return { playerId: p.id, name: p.name, vp, turns: p.turnsTaken, breakdown };
}

export function isGameOver(state: GameState): boolean {
  return state.supply.province === 0 || emptyPileCount(state) >= 3;
}

export function computeResult(state: GameState): GameResult {
  const scores = state.players.map(scorePlayer);
  const best = Math.max(...scores.map((s) => s.vp));
  const tied = scores.filter((s) => s.vp === best);
  const fewest = Math.min(...tied.map((s) => s.turns));
  return { scores, winners: tied.filter((s) => s.turns === fewest).map((s) => s.playerId) };
}
```

- [ ] **Step 8: Implement the testkit**

`src/engine/testkit.ts`:
```ts
// Helpers for tests only. Not imported by production code.
import { createGame, freshTurn } from './setup';
import type { CardId, GameState, Intent, PlayerState } from './types';

export const TEST_KINGDOM: CardId[] = [
  'cellar', 'chapel', 'moat', 'village', 'workshop', 'militia', 'smithy', 'festival', 'laboratory', 'market',
];

/** A fresh game where player 0 is to move and the log is empty. Player ids are p0, p1, ... */
export function newState(opts: { players?: number; kingdom?: CardId[]; seed?: number } = {}): GameState {
  const n = opts.players ?? 2;
  const state = createGame({
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
    kingdom: opts.kingdom ?? TEST_KINGDOM,
    seed: opts.seed ?? 1,
  });
  state.turn = freshTurn(0);
  state.log = [];
  return state;
}

type Zones = Partial<Pick<PlayerState, 'deck' | 'hand' | 'discard' | 'inPlay'>>;

export function setZones(state: GameState, player: number, zones: Zones): void {
  Object.assign(state.players[player], structuredClone(zones));
}

export const answerCards = (indices: number[]): Intent => ({ type: 'answerPrompt', answer: { kind: 'cards', indices } });
export const answerSupply = (card: CardId | null): Intent => ({ type: 'answerPrompt', answer: { kind: 'supply', card } });
export const answerOption = (index: number): Intent => ({ type: 'answerPrompt', answer: { kind: 'option', index } });
export const answerOrder = (order: number[]): Intent => ({ type: 'answerPrompt', answer: { kind: 'order', order } });
```

- [ ] **Step 9: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS (all tests so far, 22 total), typecheck clean.

- [ ] **Step 10: Commit**

```bash
git add src/engine
git commit -m "feat: add game setup, drawing/reshuffle and scoring" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Game core: intents, turn flow, prompts and the first cards

**Files:**
- Create: `src/engine/prompts.ts`, `src/engine/context.ts`, `src/engine/game.ts`, `src/cards/effects/simple.ts`
- Modify: `src/cards/effects/index.ts`
- Test: `src/engine/prompts.test.ts`, `src/engine/game.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–2.
- Produces:
  - `prompts.ts`: `validateAnswer(prompt: Prompt, answer: unknown): string | null` (null = valid)
  - `context.ts`: `createContext(state: GameState, me: number): EffectContext`
  - `game.ts`: `class Game { readonly state: GameState; constructor(state); static create(opts: SetupOptions): Game; apply(playerId: string, intent: Intent): ApplyResult }`
  - `effects/simple.ts`: `SIMPLE_EFFECTS` (village, smithy, laboratory, festival, market, chapel)

- [ ] **Step 1: Write the failing prompt validation test**

`src/engine/prompts.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateAnswer } from './prompts';
import type { Prompt } from './types';

const cards: Prompt = {
  kind: 'chooseCards', player: 0, message: '', cards: ['copper', 'estate', 'silver'], selectable: [0, 2], min: 1, max: 2,
};
const supply: Prompt = { kind: 'chooseSupply', player: 0, message: '', piles: ['silver', 'village'], optional: false };
const option: Prompt = { kind: 'chooseOption', player: 0, message: '', options: ['Yes', 'No'] };
const order: Prompt = { kind: 'orderCards', player: 0, message: '', cards: ['gold', 'estate'] };

describe('validateAnswer', () => {
  it('validates card selections', () => {
    expect(validateAnswer(cards, { kind: 'cards', indices: [0, 2] })).toBeNull();
    expect(validateAnswer(cards, { kind: 'cards', indices: [1] })).toBe('That card cannot be chosen');
    expect(validateAnswer(cards, { kind: 'cards', indices: [] })).toBe('Choose between 1 and 2 cards');
    expect(validateAnswer(cards, { kind: 'cards', indices: [0, 0] })).toBe('Duplicate selection');
    expect(validateAnswer(cards, { kind: 'cards', indices: [0.5] })).toBe('Invalid selection');
    expect(validateAnswer(cards, { kind: 'option', index: 0 })).toBe('Expected a card selection');
  });

  it('validates supply choices', () => {
    expect(validateAnswer(supply, { kind: 'supply', card: 'village' })).toBeNull();
    expect(validateAnswer(supply, { kind: 'supply', card: 'gold' })).toBe('That pile cannot be chosen');
    expect(validateAnswer(supply, { kind: 'supply', card: null })).toBe('You must choose a pile');
    expect(validateAnswer({ ...supply, optional: true }, { kind: 'supply', card: null })).toBeNull();
  });

  it('validates options', () => {
    expect(validateAnswer(option, { kind: 'option', index: 1 })).toBeNull();
    expect(validateAnswer(option, { kind: 'option', index: 2 })).toBe('Invalid option');
  });

  it('validates orders', () => {
    expect(validateAnswer(order, { kind: 'order', order: [1, 0] })).toBeNull();
    expect(validateAnswer(order, { kind: 'order', order: [0] })).toBe('Order must include every card');
    expect(validateAnswer(order, { kind: 'order', order: [0, 0] })).toBe('Order must include every card once');
  });

  it('rejects malformed answers', () => {
    expect(validateAnswer(cards, null)).toBe('Invalid answer');
    expect(validateAnswer(cards, 'cards')).toBe('Invalid answer');
  });
});
```

- [ ] **Step 2: Write the failing game test**

`src/engine/game.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { answerCards, newState, setZones } from './testkit';
import type { CardId } from './types';

const ESTATES: CardId[] = ['estate', 'estate', 'estate', 'estate', 'estate'];

function gameWithHand(hand: CardId[], deck: CardId[] = ESTATES): Game {
  const state = newState();
  setZones(state, 0, { hand, deck, discard: [] });
  return new Game(state);
}

describe('turn flow', () => {
  it('plays treasures and buys a card', () => {
    const g = gameWithHand(['copper', 'copper', 'copper', 'estate', 'estate']);
    expect(g.apply('p0', { type: 'playAllTreasures' })).toEqual({ ok: true });
    expect(g.state.turn).toMatchObject({ phase: 'buy', coins: 3 });
    expect(g.state.players[0].inPlay).toEqual(['copper', 'copper', 'copper']);
    expect(g.apply('p0', { type: 'buy', card: 'silver' })).toEqual({ ok: true });
    expect(g.state.players[0].discard).toEqual(['silver']);
    expect(g.state.supply.silver).toBe(39);
    expect(g.state.turn).toMatchObject({ coins: 0, buys: 0 });
  });

  it('rejects a buy you cannot afford and leaves state unchanged', () => {
    const g = gameWithHand(['copper', 'copper', 'copper', 'estate', 'estate']);
    g.apply('p0', { type: 'playAllTreasures' });
    const before = structuredClone(g.state);
    expect(g.apply('p0', { type: 'buy', card: 'gold' })).toEqual({ ok: false, reason: 'Not enough coins' });
    expect(g.state).toEqual(before);
  });

  it('rejects buys from missing or empty piles and with no Buys left', () => {
    const g = gameWithHand(['copper', 'copper', 'copper', 'copper', 'copper']);
    g.apply('p0', { type: 'playAllTreasures' });
    expect(g.apply('p0', { type: 'buy', card: 'witch' })).toEqual({ ok: false, reason: 'No such pile' });
    g.state.supply.village = 0;
    expect(g.apply('p0', { type: 'buy', card: 'village' })).toEqual({ ok: false, reason: 'That pile is empty' });
    g.apply('p0', { type: 'buy', card: 'copper' });
    expect(g.apply('p0', { type: 'buy', card: 'copper' })).toEqual({ ok: false, reason: 'No Buys left' });
  });

  it('does not allow Treasures after buying', () => {
    const g = gameWithHand(['copper', 'copper', 'copper', 'copper', 'copper']);
    g.apply('p0', { type: 'playTreasure', handIndex: 0 });
    g.apply('p0', { type: 'buy', card: 'copper' });
    expect(g.apply('p0', { type: 'playTreasure', handIndex: 0 })).toEqual({
      ok: false, reason: 'You cannot play Treasures after buying',
    });
  });

  it('rejects moves out of turn and from unknown players', () => {
    const g = gameWithHand(ESTATES);
    expect(g.apply('p1', { type: 'endPhase' })).toEqual({ ok: false, reason: 'It is not your turn' });
    expect(g.apply('zz', { type: 'endPhase' })).toEqual({ ok: false, reason: 'Unknown player' });
    expect(g.apply('p0', { type: 'answerPrompt', answer: { kind: 'option', index: 0 } })).toEqual({
      ok: false, reason: 'Nothing to answer',
    });
  });

  it('enforces Action rules', () => {
    const g = gameWithHand(['smithy', 'smithy', 'copper', 'estate', 'estate'], Array(10).fill('estate'));
    expect(g.apply('p0', { type: 'playAction', handIndex: 2 })).toEqual({ ok: false, reason: 'That is not an Action card' });
    expect(g.apply('p0', { type: 'playAction', handIndex: 9 })).toEqual({ ok: false, reason: 'No such card in hand' });
    expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({ ok: true });
    expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({ ok: false, reason: 'No Actions left' });
    g.apply('p0', { type: 'endPhase' });
    expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({
      ok: false, reason: 'You can only play Actions in your Action phase',
    });
  });

  it('cleans up and passes the turn', () => {
    const g = gameWithHand(['copper', 'copper', 'copper', 'copper', 'copper']);
    g.apply('p0', { type: 'endPhase' });
    g.apply('p0', { type: 'endPhase' });
    const p0 = g.state.players[0];
    expect(p0.hand).toEqual(ESTATES);
    expect(p0.discard).toEqual(['copper', 'copper', 'copper', 'copper', 'copper']);
    expect(p0.turnsTaken).toBe(1);
    expect(g.state.turn).toMatchObject({ player: 1, phase: 'action', actions: 1, buys: 1, coins: 0 });
  });

  it('ends the game at the end of the turn when Provinces run out', () => {
    const g = gameWithHand(ESTATES);
    g.state.supply.province = 0;
    g.apply('p0', { type: 'endPhase' });
    expect(g.state.result).toBeNull();
    g.apply('p0', { type: 'endPhase' });
    expect(g.state.result).not.toBeNull();
    expect(g.state.result!.scores).toHaveLength(2);
    expect(g.apply('p1', { type: 'endPhase' })).toEqual({ ok: false, reason: 'The game is over' });
  });
});

describe('simple action cards', () => {
  it('Village then Smithy', () => {
    const g = gameWithHand(['village', 'smithy', 'copper', 'copper', 'copper'], Array(10).fill('estate'));
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.turn.actions).toBe(2);
    expect(g.state.players[0].hand).toHaveLength(5);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.turn.actions).toBe(1);
    expect(g.state.players[0].hand).toHaveLength(7);
    expect(g.state.players[0].inPlay).toEqual(['village', 'smithy']);
    expect(g.state.log.map((l) => l.text)).toEqual(['plays', 'plays']);
  });

  it('Festival and Market', () => {
    const g = gameWithHand(['festival', 'market', 'estate', 'estate', 'estate'], ['copper']);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.turn).toMatchObject({ actions: 2, buys: 3, coins: 3 });
    expect(g.state.players[0].hand).toContain('copper');
  });

  it('Laboratory', () => {
    const g = gameWithHand(['laboratory', 'estate', 'estate', 'estate', 'estate'], ['gold', 'gold']);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.turn.actions).toBe(1);
    expect(g.state.players[0].hand).toEqual(['estate', 'estate', 'estate', 'estate', 'gold', 'gold']);
  });

  it('Chapel prompts the player and trashes the chosen cards', () => {
    const g = gameWithHand(['chapel', 'copper', 'copper', 'estate', 'estate']);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.pending).toMatchObject({
      kind: 'chooseCards', player: 0, min: 0, max: 4, cards: ['copper', 'copper', 'estate', 'estate'],
    });
    expect(g.apply('p0', { type: 'endPhase' })).toEqual({ ok: false, reason: 'Waiting for a choice to be made' });
    expect(g.apply('p1', answerCards([2, 3]))).toEqual({ ok: false, reason: 'It is not your choice to make' });
    expect(g.apply('p0', answerCards([0, 0]))).toEqual({ ok: false, reason: 'Duplicate selection' });
    expect(g.apply('p0', answerCards([2, 3]))).toEqual({ ok: true });
    expect(g.state.trash).toEqual(['estate', 'estate']);
    expect(g.state.players[0].hand).toEqual(['copper', 'copper']);
    expect(g.state.pending).toBeNull();
  });

  it('Chapel with an empty hand does not prompt', () => {
    const g = gameWithHand(['chapel']);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.pending).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/engine/prompts.test.ts src/engine/game.test.ts`
Expected: FAIL, cannot resolve `./prompts` and `./game`.

- [ ] **Step 4: Implement prompt validation**

`src/engine/prompts.ts`:
```ts
import type { Prompt } from './types';

/** Returns null if `answer` is a legal answer to `prompt`, otherwise a reason. */
export function validateAnswer(prompt: Prompt, answer: unknown): string | null {
  if (!answer || typeof answer !== 'object') return 'Invalid answer';
  const a = answer as Record<string, unknown>;
  switch (prompt.kind) {
    case 'chooseCards': {
      if (a.kind !== 'cards') return 'Expected a card selection';
      const indices = a.indices;
      if (!Array.isArray(indices) || !indices.every((i) => Number.isInteger(i))) return 'Invalid selection';
      if (new Set(indices).size !== indices.length) return 'Duplicate selection';
      if (indices.length < prompt.min || indices.length > prompt.max) {
        return `Choose between ${prompt.min} and ${prompt.max} cards`;
      }
      if (!indices.every((i) => prompt.selectable.includes(i))) return 'That card cannot be chosen';
      return null;
    }
    case 'chooseSupply': {
      if (a.kind !== 'supply') return 'Expected a supply pile';
      if (a.card === null) return prompt.optional ? null : 'You must choose a pile';
      return typeof a.card === 'string' && prompt.piles.includes(a.card) ? null : 'That pile cannot be chosen';
    }
    case 'chooseOption': {
      if (a.kind !== 'option') return 'Expected an option';
      const i = a.index;
      return Number.isInteger(i) && (i as number) >= 0 && (i as number) < prompt.options.length ? null : 'Invalid option';
    }
    case 'orderCards': {
      if (a.kind !== 'order') return 'Expected an order';
      const order = a.order;
      if (!Array.isArray(order) || order.length !== prompt.cards.length) return 'Order must include every card';
      const sorted = [...order].sort((x, y) => x - y);
      return sorted.every((v, i) => v === i) ? null : 'Order must include every card once';
    }
  }
}
```

- [ ] **Step 5: Implement the effect context**

`src/engine/context.ts`:
```ts
import { getCard, isType } from '../cards/registry';
import type { EffectContext, Gen } from '../cards/types';
import type { CardId, GameState, PlayerState, PromptAnswer } from './types';
import { drawCards, emptyPileCount, takeTop } from './zones';

type AnswerOf<K extends PromptAnswer['kind']> = Extract<PromptAnswer, { kind: K }>;

function removeFromHand(p: PlayerState, indices: number[]): CardId[] {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const cards = sorted.map((i) => p.hand[i]);
  for (const i of [...sorted].reverse()) p.hand.splice(i, 1);
  return cards;
}

export function createContext(state: GameState, me: number): EffectContext {
  const ctx: EffectContext = {
    me,
    state,

    opponents() {
      const n = state.players.length;
      return Array.from({ length: n - 1 }, (_, k) => (me + 1 + k) % n);
    },
    cost: (card) => getCard(card).cost,
    isType: (card, type) => isType(card, type),

    draw: (player, n) => drawCards(state, player, n),
    addActions(n) { state.turn.actions += n; },
    addBuys(n) { state.turn.buys += n; },
    addCoins(n) { state.turn.coins += n; },

    gain(player, card, to = 'discard') {
      if ((state.supply[card] ?? 0) <= 0) return false;
      state.supply[card]--;
      const p = state.players[player];
      if (to === 'hand') p.hand.push(card);
      else if (to === 'deck') p.deck.unshift(card);
      else p.discard.push(card);
      ctx.log(player, 'gains', [card]);
      return true;
    },
    trashFromHand(player, handIndices) {
      const cards = removeFromHand(state.players[player], handIndices);
      ctx.trashCards(player, cards);
      return cards;
    },
    discardFromHand(player, handIndices) {
      const cards = removeFromHand(state.players[player], handIndices);
      ctx.discardCards(player, cards);
      return cards;
    },
    topdeckFromHand(player, handIndex) {
      const [card] = removeFromHand(state.players[player], [handIndex]);
      state.players[player].deck.unshift(card);
      ctx.log(player, 'puts a card onto their deck');
      return card;
    },
    takeFromDeck(player, n) {
      const out: CardId[] = [];
      for (let i = 0; i < n; i++) {
        const card = takeTop(state, player);
        if (card === undefined) break;
        out.push(card);
      }
      return out;
    },
    putOnDeck(player, cards) {
      state.players[player].deck.unshift(...cards);
    },
    discardCards(player, cards) {
      if (cards.length === 0) return;
      state.players[player].discard.push(...cards);
      ctx.log(player, 'discards', cards);
    },
    trashCards(player, cards) {
      if (cards.length === 0) return;
      state.trash.push(...cards);
      ctx.log(player, 'trashes', cards);
    },
    emptySupplyPiles: () => emptyPileCount(state),
    log(player, text, cards) {
      state.log.push(cards ? { player, text, cards: [...cards] } : { player, text });
    },

    *chooseFromHand(player, opts): Gen<number[]> {
      const hand = state.players[player].hand;
      const selectable = hand.map((_, i) => i).filter((i) => !opts.filter || opts.filter(hand[i]));
      return yield* ctx.chooseCards(player, hand, { min: opts.min, max: opts.max, message: opts.message, selectable });
    },
    *chooseCards(player, cards, opts): Gen<number[]> {
      const selectable = opts.selectable ?? cards.map((_, i) => i);
      const max = Math.min(opts.max, selectable.length);
      const min = Math.min(opts.min, max);
      if (max === 0) return [];
      if (selectable.length === min) return [...selectable];
      const answer = yield {
        kind: 'chooseCards', player, message: opts.message, cards: [...cards], selectable, min, max,
      };
      return (answer as AnswerOf<'cards'>).indices;
    },
    *chooseSupply(player, opts): Gen<CardId | null> {
      const piles = Object.keys(state.supply).filter(
        (id) => state.supply[id] > 0 && getCard(id).cost <= opts.maxCost && (!opts.type || isType(id, opts.type)),
      );
      if (piles.length === 0) return null;
      const answer = yield { kind: 'chooseSupply', player, message: opts.message, piles, optional: opts.optional ?? false };
      return (answer as AnswerOf<'supply'>).card;
    },
    *chooseOption(player, message, options, cards): Gen<number> {
      const answer = yield cards
        ? { kind: 'chooseOption', player, message, options, cards: [...cards] }
        : { kind: 'chooseOption', player, message, options };
      return (answer as AnswerOf<'option'>).index;
    },
    *orderCards(player, cards, message): Gen<CardId[]> {
      if (cards.length <= 1) return [...cards];
      const answer = yield { kind: 'orderCards', player, message, cards: [...cards] };
      return (answer as AnswerOf<'order'>).order.map((i) => cards[i]);
    },
    *attackedOpponents(): Gen<number[]> {
      const hit: number[] = [];
      for (const opp of ctx.opponents()) {
        if (state.players[opp].hand.some((c) => isType(c, 'reaction'))) {
          const choice = yield* ctx.chooseOption(opp, 'An attack is coming. Reveal your Reaction to block it?', [
            'Reveal',
            "Don't reveal",
          ]);
          if (choice === 0) {
            ctx.log(opp, 'reveals', ['moat']);
            continue;
          }
        }
        hit.push(opp);
      }
      return hit;
    },
    *playCard(card): Gen {
      const effect = getCard(card).play;
      if (effect) yield* effect(ctx);
    },
  };
  return ctx;
}
```

- [ ] **Step 6: Implement the Game class**

`src/engine/game.ts`:
```ts
import { getCard, isType } from '../cards/registry';
import type { Gen } from '../cards/types';
import { createContext } from './context';
import { validateAnswer } from './prompts';
import { computeResult, isGameOver } from './scoring';
import { createGame, freshTurn, type SetupOptions } from './setup';
import type { ApplyResult, CardId, GameState, Intent, PlayerState, PromptAnswer } from './types';
import { drawCards } from './zones';

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

export class Game {
  readonly state: GameState;
  /** The card effect paused on a prompt. Lives only in host memory. */
  private effect: Gen | null = null;

  constructor(state: GameState) {
    this.state = state;
  }

  static create(opts: SetupOptions): Game {
    return new Game(createGame(opts));
  }

  apply(playerId: string, intent: Intent): ApplyResult {
    const s = this.state;
    if (s.result) return fail('The game is over');
    const player = s.players.findIndex((p) => p.id === playerId);
    if (player < 0) return fail('Unknown player');
    if (!intent || typeof intent !== 'object') return fail('Invalid intent');

    if (s.pending) {
      if (intent.type !== 'answerPrompt') return fail('Waiting for a choice to be made');
      if (s.pending.player !== player) return fail('It is not your choice to make');
      const err = validateAnswer(s.pending, intent.answer);
      if (err) return fail(err);
      this.resume(intent.answer);
      return ok();
    }
    if (intent.type === 'answerPrompt') return fail('Nothing to answer');
    if (player !== s.turn.player) return fail('It is not your turn');

    switch (intent.type) {
      case 'playAction': return this.playAction(intent.handIndex);
      case 'playTreasure': return this.playTreasure(intent.handIndex);
      case 'playAllTreasures': return this.playAllTreasures();
      case 'buy': return this.buy(intent.card);
      case 'endPhase': return this.endPhase();
      default: return fail('Unknown intent');
    }
  }

  private get current(): PlayerState {
    return this.state.players[this.state.turn.player];
  }

  private log(player: number | null, text: string, cards?: CardId[]): void {
    this.state.log.push(cards ? { player, text, cards: [...cards] } : { player, text });
  }

  private validHandIndex(i: number): boolean {
    return Number.isInteger(i) && i >= 0 && i < this.current.hand.length;
  }

  private playAction(i: number): ApplyResult {
    const { turn } = this.state;
    if (turn.phase !== 'action') return fail('You can only play Actions in your Action phase');
    if (!this.validHandIndex(i)) return fail('No such card in hand');
    const card = this.current.hand[i];
    if (!isType(card, 'action')) return fail('That is not an Action card');
    if (turn.actions < 1) return fail('No Actions left');

    turn.actions--;
    this.current.hand.splice(i, 1);
    this.current.inPlay.push(card);
    this.log(turn.player, 'plays', [card]);
    this.effect = createContext(this.state, turn.player).playCard(card);
    this.resume(undefined);
    return ok();
  }

  /** Runs the paused effect until it needs another answer or finishes. */
  private resume(answer: PromptAnswer | undefined): void {
    const effect = this.effect;
    if (!effect) return;
    const step = answer === undefined ? effect.next() : effect.next(answer);
    if (step.done) {
      this.effect = null;
      this.state.pending = null;
    } else {
      this.state.pending = step.value;
    }
  }

  private playTreasure(i: number): ApplyResult {
    if (this.state.turn.boughtThisTurn) return fail('You cannot play Treasures after buying');
    if (!this.validHandIndex(i)) return fail('No such card in hand');
    const card = this.current.hand[i];
    if (!isType(card, 'treasure')) return fail('That is not a Treasure');
    this.playTreasureAt(i);
    this.log(this.state.turn.player, 'plays', [card]);
    return ok();
  }

  private playAllTreasures(): ApplyResult {
    if (this.state.turn.boughtThisTurn) return fail('You cannot play Treasures after buying');
    const treasures = this.current.hand.filter((c) => isType(c, 'treasure'));
    if (treasures.length === 0) return fail('No Treasures to play');
    for (const card of treasures) this.playTreasureAt(this.current.hand.indexOf(card));
    this.log(this.state.turn.player, 'plays', treasures);
    return ok();
  }

  private playTreasureAt(i: number): void {
    const { turn } = this.state;
    const [card] = this.current.hand.splice(i, 1);
    this.current.inPlay.push(card);
    turn.phase = 'buy';
    turn.coins += getCard(card).coins ?? 0;
    if (card === 'silver' && !turn.silverPlayed) {
      turn.silverPlayed = true;
      turn.coins += turn.merchants;
    }
  }

  private buy(card: CardId): ApplyResult {
    const { turn, supply } = this.state;
    if (typeof card !== 'string' || supply[card] === undefined) return fail('No such pile');
    if (supply[card] <= 0) return fail('That pile is empty');
    if (turn.buys < 1) return fail('No Buys left');
    const cost = getCard(card).cost;
    if (cost > turn.coins) return fail('Not enough coins');

    turn.phase = 'buy';
    turn.coins -= cost;
    turn.buys--;
    turn.boughtThisTurn = true;
    supply[card]--;
    this.current.discard.push(card);
    this.log(turn.player, 'buys', [card]);
    return ok();
  }

  private endPhase(): ApplyResult {
    if (this.state.turn.phase === 'action') {
      this.state.turn.phase = 'buy';
      return ok();
    }
    this.cleanup();
    return ok();
  }

  private cleanup(): void {
    const s = this.state;
    const p = this.current;
    p.discard.push(...p.hand, ...p.inPlay);
    p.hand = [];
    p.inPlay = [];
    drawCards(s, s.turn.player, 5);
    p.turnsTaken++;
    if (isGameOver(s)) {
      s.result = computeResult(s);
      this.log(null, 'Game over');
      return;
    }
    s.turn = freshTurn((s.turn.player + 1) % s.players.length);
  }
}
```

- [ ] **Step 7: Implement the first card effects**

`src/cards/effects/simple.ts`:
```ts
import type { CardId } from '../../engine/types';
import type { Effect } from '../types';

export const SIMPLE_EFFECTS: Record<CardId, Effect> = {
  *village(ctx) {
    ctx.draw(ctx.me, 1);
    ctx.addActions(2);
  },
  *smithy(ctx) {
    ctx.draw(ctx.me, 3);
  },
  *laboratory(ctx) {
    ctx.draw(ctx.me, 2);
    ctx.addActions(1);
  },
  *festival(ctx) {
    ctx.addActions(2);
    ctx.addBuys(1);
    ctx.addCoins(2);
  },
  *market(ctx) {
    ctx.draw(ctx.me, 1);
    ctx.addActions(1);
    ctx.addBuys(1);
    ctx.addCoins(1);
  },
  *chapel(ctx) {
    const picked = yield* ctx.chooseFromHand(ctx.me, { min: 0, max: 4, message: 'Trash up to 4 cards from your hand' });
    ctx.trashFromHand(ctx.me, picked);
  },
};
```

`src/cards/effects/index.ts`:
```ts
import type { CardId } from '../../engine/types';
import type { Effect } from '../types';
import { SIMPLE_EFFECTS } from './simple';

export const EFFECTS: Record<CardId, Effect> = {
  ...SIMPLE_EFFECTS,
};
```

- [ ] **Step 8: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat: add game core with intents, turn flow and prompt-driven card effects" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Hand, draw and gain cards

**Files:**
- Create: `src/cards/effects/hand.ts`
- Modify: `src/cards/effects/index.ts`
- Test: `src/cards/effects/hand.test.ts`

**Interfaces:**
- Consumes: `EffectContext` (Task 1), `Game`, testkit helpers.
- Produces: `HAND_EFFECTS` (cellar, moat, merchant, council_room, moneylender, poacher, workshop, harbinger, vassal).

- [ ] **Step 1: Write the failing tests**

`src/cards/effects/hand.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../../engine/game';
import { answerCards, answerOption, answerSupply, newState, setZones } from '../../engine/testkit';
import type { CardId } from '../../engine/types';

const ESTATES: CardId[] = ['estate', 'estate', 'estate', 'estate'];

function play(hand: CardId[], deck: CardId[], discard: CardId[] = []): Game {
  const state = newState();
  setZones(state, 0, { hand, deck, discard });
  const g = new Game(state);
  expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({ ok: true });
  return g;
}

describe('Cellar', () => {
  it('discards chosen cards and draws that many', () => {
    const g = play(['cellar', 'estate', 'estate', 'copper', 'copper'], ['silver', 'silver', 'gold']);
    expect(g.state.turn.actions).toBe(1);
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', min: 0, max: 4 });
    g.apply('p0', answerCards([0, 1]));
    expect(g.state.players[0].hand).toEqual(['copper', 'copper', 'silver', 'silver']);
    expect(g.state.players[0].discard).toEqual(['estate', 'estate']);
  });
});

describe('Moat', () => {
  it('draws 2 cards when played', () => {
    const g = play(['moat', ...ESTATES], ['gold', 'gold']);
    expect(g.state.players[0].hand).toHaveLength(6);
  });
});

describe('Merchant', () => {
  it('adds $1 per Merchant to the first Silver only', () => {
    const g = play(['merchant', 'merchant', 'silver', 'silver', 'copper'], ['estate', 'estate']);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    g.apply('p0', { type: 'playAllTreasures' });
    expect(g.state.turn.coins).toBe(2 + 2 + 1 + 2);
  });
});

describe('Council Room', () => {
  it('draws 4, +1 Buy, and each other player draws 1', () => {
    const g = play(['council_room', ...ESTATES], ['copper', 'copper', 'copper', 'copper']);
    expect(g.state.players[0].hand).toHaveLength(8);
    expect(g.state.turn.buys).toBe(2);
    expect(g.state.players[1].hand).toHaveLength(6);
  });
});

describe('Moneylender', () => {
  it('may trash a Copper for +$3', () => {
    const g = play(['moneylender', 'copper', 'estate', 'estate'], []);
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', selectable: [0], min: 0, max: 1 });
    g.apply('p0', answerCards([0]));
    expect(g.state.trash).toEqual(['copper']);
    expect(g.state.turn.coins).toBe(3);
  });

  it('does nothing when declined', () => {
    const g = play(['moneylender', 'copper', 'estate'], []);
    g.apply('p0', answerCards([]));
    expect(g.state.trash).toEqual([]);
    expect(g.state.turn.coins).toBe(0);
  });

  it('does not prompt without a Copper', () => {
    const g = play(['moneylender', ...ESTATES], []);
    expect(g.state.pending).toBeNull();
  });
});

describe('Poacher', () => {
  it('discards a card per empty Supply pile', () => {
    const state = newState();
    state.supply.cellar = 0;
    state.supply.chapel = 0;
    setZones(state, 0, { hand: ['poacher', 'estate', 'estate', 'copper', 'copper'], deck: ['gold'], discard: [] });
    const g = new Game(state);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.turn).toMatchObject({ actions: 1, coins: 1 });
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', min: 2, max: 2 });
    g.apply('p0', answerCards([0, 1]));
    expect(g.state.players[0].discard).toEqual(['estate', 'estate']);
  });

  it('does not prompt with no empty piles', () => {
    const g = play(['poacher', ...ESTATES], ['gold']);
    expect(g.state.pending).toBeNull();
  });
});

describe('Workshop', () => {
  it('gains a card costing up to $4', () => {
    const g = play(['workshop', ...ESTATES], []);
    const pending = g.state.pending;
    expect(pending?.kind).toBe('chooseSupply');
    if (pending?.kind !== 'chooseSupply') return;
    expect(pending.piles).toContain('village');
    expect(pending.piles).toContain('silver');
    expect(pending.piles).not.toContain('festival');
    expect(pending.piles).not.toContain('gold');
    g.apply('p0', answerSupply('village'));
    expect(g.state.players[0].discard).toEqual(['village']);
    expect(g.state.supply.village).toBe(9);
  });
});

describe('Harbinger', () => {
  it('may put a card from the discard pile onto the deck', () => {
    const g = play(['harbinger', ...ESTATES], ['copper'], ['gold', 'estate']);
    expect(g.state.turn.actions).toBe(1);
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', cards: ['gold', 'estate'], min: 0, max: 1 });
    g.apply('p0', answerCards([0]));
    expect(g.state.players[0].deck[0]).toBe('gold');
    expect(g.state.players[0].discard).toEqual(['estate']);
  });
});

describe('Vassal', () => {
  it('may play a discarded Action card', () => {
    const g = play(['vassal', ...ESTATES], ['village', 'copper']);
    expect(g.state.turn.coins).toBe(2);
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', player: 0, cards: ['village'] });
    g.apply('p0', answerOption(0));
    expect(g.state.players[0].inPlay).toEqual(['vassal', 'village']);
    expect(g.state.players[0].discard).toEqual([]);
    expect(g.state.players[0].hand).toContain('copper');
    expect(g.state.turn.actions).toBe(2);
  });

  it('just discards a non-Action card', () => {
    const g = play(['vassal', ...ESTATES], ['gold']);
    expect(g.state.players[0].discard).toEqual(['gold']);
    expect(g.state.pending).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cards/effects/hand.test.ts`
Expected: FAIL. Cards resolve with no effect (for example Cellar has no pending prompt).

- [ ] **Step 3: Implement the effects**

`src/cards/effects/hand.ts`:
```ts
import type { CardId } from '../../engine/types';
import type { Effect } from '../types';

export const HAND_EFFECTS: Record<CardId, Effect> = {
  *cellar(ctx) {
    ctx.addActions(1);
    const hand = ctx.state.players[ctx.me].hand;
    const picked = yield* ctx.chooseFromHand(ctx.me, {
      min: 0, max: hand.length, message: 'Discard any number of cards, then draw that many',
    });
    ctx.discardFromHand(ctx.me, picked);
    ctx.draw(ctx.me, picked.length);
  },
  *moat(ctx) {
    ctx.draw(ctx.me, 2);
  },
  *merchant(ctx) {
    ctx.draw(ctx.me, 1);
    ctx.addActions(1);
    ctx.state.turn.merchants++;
  },
  *council_room(ctx) {
    ctx.draw(ctx.me, 4);
    ctx.addBuys(1);
    for (const opp of ctx.opponents()) ctx.draw(opp, 1);
  },
  *moneylender(ctx) {
    const picked = yield* ctx.chooseFromHand(ctx.me, {
      min: 0, max: 1, message: 'You may trash a Copper for +$3', filter: (c) => c === 'copper',
    });
    if (picked.length === 0) return;
    ctx.trashFromHand(ctx.me, picked);
    ctx.addCoins(3);
  },
  *poacher(ctx) {
    ctx.draw(ctx.me, 1);
    ctx.addActions(1);
    ctx.addCoins(1);
    const n = Math.min(ctx.emptySupplyPiles(), ctx.state.players[ctx.me].hand.length);
    const picked = yield* ctx.chooseFromHand(ctx.me, { min: n, max: n, message: `Discard ${n} card(s)` });
    ctx.discardFromHand(ctx.me, picked);
  },
  *workshop(ctx) {
    const card = yield* ctx.chooseSupply(ctx.me, { maxCost: 4, message: 'Gain a card costing up to $4' });
    if (card) ctx.gain(ctx.me, card);
  },
  *harbinger(ctx) {
    ctx.draw(ctx.me, 1);
    ctx.addActions(1);
    const discard = ctx.state.players[ctx.me].discard;
    const picked = yield* ctx.chooseCards(ctx.me, discard, {
      min: 0, max: 1, message: 'You may put a card from your discard pile onto your deck',
    });
    if (picked.length === 0) return;
    const [card] = discard.splice(picked[0], 1);
    ctx.putOnDeck(ctx.me, [card]);
    ctx.log(ctx.me, 'puts a card from their discard pile onto their deck');
  },
  *vassal(ctx) {
    ctx.addCoins(2);
    const [card] = ctx.takeFromDeck(ctx.me, 1);
    if (card === undefined) return;
    ctx.discardCards(ctx.me, [card]);
    if (!ctx.isType(card, 'action')) return;
    const choice = yield* ctx.chooseOption(ctx.me, 'Play the discarded Action card?', ['Play it', 'Leave it'], [card]);
    if (choice !== 0) return;
    const me = ctx.state.players[ctx.me];
    me.discard.splice(me.discard.lastIndexOf(card), 1);
    me.inPlay.push(card);
    ctx.log(ctx.me, 'plays', [card]);
    yield* ctx.playCard(card);
  },
};
```

`src/cards/effects/index.ts`:
```ts
import type { CardId } from '../../engine/types';
import type { Effect } from '../types';
import { HAND_EFFECTS } from './hand';
import { SIMPLE_EFFECTS } from './simple';

export const EFFECTS: Record<CardId, Effect> = {
  ...SIMPLE_EFFECTS,
  ...HAND_EFFECTS,
};
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/cards
git commit -m "feat: add Cellar, Moat, Merchant, Council Room, Moneylender, Poacher, Workshop, Harbinger, Vassal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Transform cards and Throne Room

**Files:**
- Create: `src/cards/effects/transform.ts`
- Modify: `src/cards/effects/index.ts`
- Test: `src/cards/effects/transform.test.ts`

**Interfaces:**
- Consumes: `EffectContext`, `Game`, testkit.
- Produces: `TRANSFORM_EFFECTS` (remodel, mine, artisan, throne_room).

- [ ] **Step 1: Write the failing tests**

`src/cards/effects/transform.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../../engine/game';
import { answerCards, answerSupply, newState, setZones } from '../../engine/testkit';
import type { CardId } from '../../engine/types';

function play(hand: CardId[], deck: CardId[] = []): Game {
  const state = newState({ kingdom: ['cellar', 'chapel', 'moat', 'village', 'workshop', 'militia', 'smithy', 'festival', 'throne_room', 'market'] });
  setZones(state, 0, { hand, deck, discard: [] });
  const g = new Game(state);
  expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({ ok: true });
  return g;
}

function supplyPiles(g: Game): CardId[] {
  const p = g.state.pending;
  if (p?.kind !== 'chooseSupply') throw new Error(`Expected chooseSupply, got ${p?.kind}`);
  return p.piles;
}

describe('Remodel', () => {
  it('trashes a card and gains one costing up to $2 more', () => {
    const g = play(['remodel', 'estate', 'copper', 'copper', 'copper']);
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', min: 1, max: 1 });
    g.apply('p0', answerCards([0]));
    expect(g.state.trash).toEqual(['estate']);
    expect(supplyPiles(g)).toEqual(expect.arrayContaining(['silver', 'smithy', 'village']));
    expect(supplyPiles(g)).not.toContain('gold');
    expect(supplyPiles(g)).not.toContain('festival');
    g.apply('p0', answerSupply('smithy'));
    expect(g.state.players[0].discard).toEqual(['smithy']);
  });

  it('does nothing with an empty hand', () => {
    const g = play(['remodel']);
    expect(g.state.pending).toBeNull();
  });
});

describe('Mine', () => {
  it('upgrades a Treasure into hand', () => {
    const g = play(['mine', 'copper', 'estate']);
    g.apply('p0', answerCards([0]));
    expect(supplyPiles(g).sort()).toEqual(['copper', 'silver']);
    g.apply('p0', answerSupply('silver'));
    expect(g.state.players[0].hand).toEqual(['estate', 'silver']);
    expect(g.state.trash).toEqual(['copper']);
  });

  it('does not prompt without a Treasure', () => {
    const g = play(['mine', 'estate']);
    expect(g.state.pending).toBeNull();
  });
});

describe('Artisan', () => {
  it('gains a card to hand then topdecks a card', () => {
    const g = play(['artisan', 'estate', 'copper']);
    expect(supplyPiles(g)).toContain('festival');
    expect(supplyPiles(g)).not.toContain('gold');
    g.apply('p0', answerSupply('festival'));
    expect(g.state.players[0].hand).toEqual(['estate', 'copper', 'festival']);
    g.apply('p0', answerCards([0]));
    expect(g.state.players[0].deck[0]).toBe('estate');
    expect(g.state.players[0].hand).toEqual(['copper', 'festival']);
  });
});

describe('Throne Room', () => {
  it('plays an Action twice', () => {
    const g = play(['throne_room', 'smithy', 'copper'], Array(10).fill('estate'));
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', selectable: [0], min: 0, max: 1 });
    g.apply('p0', answerCards([0]));
    expect(g.state.players[0].hand).toHaveLength(7);
    expect(g.state.players[0].inPlay).toEqual(['throne_room', 'smithy']);
  });

  it('may be declined', () => {
    const g = play(['throne_room', 'smithy']);
    g.apply('p0', answerCards([]));
    expect(g.state.players[0].hand).toEqual(['smithy']);
  });

  it('Throne Room on Throne Room plays two Actions twice each', () => {
    const g = play(['throne_room', 'throne_room', 'village', 'smithy', 'copper'], Array(20).fill('estate'));
    g.apply('p0', answerCards([0])); // the second Throne Room
    expect(g.state.pending).toMatchObject({ cards: ['village', 'smithy', 'copper'] });
    g.apply('p0', answerCards([0])); // Village, twice
    expect(g.state.pending).toMatchObject({ cards: ['smithy', 'copper', 'estate', 'estate'] });
    g.apply('p0', answerCards([0])); // Smithy, twice
    expect(g.state.pending).toBeNull();
    expect(g.state.turn.actions).toBe(4);
    expect(g.state.players[0].hand).toHaveLength(9);
    expect(g.state.players[0].inPlay).toEqual(['throne_room', 'throne_room', 'village', 'smithy']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cards/effects/transform.test.ts`
Expected: FAIL. The cards have no effects yet.

- [ ] **Step 3: Implement the effects**

`src/cards/effects/transform.ts`:
```ts
import type { CardId } from '../../engine/types';
import type { Effect } from '../types';

export const TRANSFORM_EFFECTS: Record<CardId, Effect> = {
  *remodel(ctx) {
    const picked = yield* ctx.chooseFromHand(ctx.me, { min: 1, max: 1, message: 'Trash a card from your hand' });
    if (picked.length === 0) return;
    const [trashed] = ctx.trashFromHand(ctx.me, picked);
    const maxCost = ctx.cost(trashed) + 2;
    const card = yield* ctx.chooseSupply(ctx.me, { maxCost, message: `Gain a card costing up to $${maxCost}` });
    if (card) ctx.gain(ctx.me, card);
  },
  *mine(ctx) {
    const picked = yield* ctx.chooseFromHand(ctx.me, {
      min: 0, max: 1, message: 'You may trash a Treasure from your hand', filter: (c) => ctx.isType(c, 'treasure'),
    });
    if (picked.length === 0) return;
    const [trashed] = ctx.trashFromHand(ctx.me, picked);
    const maxCost = ctx.cost(trashed) + 3;
    const card = yield* ctx.chooseSupply(ctx.me, {
      maxCost, type: 'treasure', message: `Gain a Treasure to your hand costing up to $${maxCost}`,
    });
    if (card) ctx.gain(ctx.me, card, 'hand');
  },
  *artisan(ctx) {
    const card = yield* ctx.chooseSupply(ctx.me, { maxCost: 5, message: 'Gain a card to your hand costing up to $5' });
    if (card) ctx.gain(ctx.me, card, 'hand');
    const picked = yield* ctx.chooseFromHand(ctx.me, { min: 1, max: 1, message: 'Put a card from your hand onto your deck' });
    if (picked.length > 0) ctx.topdeckFromHand(ctx.me, picked[0]);
  },
  *throne_room(ctx) {
    const picked = yield* ctx.chooseFromHand(ctx.me, {
      min: 0, max: 1, message: 'You may play an Action card from your hand twice', filter: (c) => ctx.isType(c, 'action'),
    });
    if (picked.length === 0) return;
    const me = ctx.state.players[ctx.me];
    const [card] = me.hand.splice(picked[0], 1);
    me.inPlay.push(card);
    ctx.log(ctx.me, 'plays', [card]);
    yield* ctx.playCard(card);
    yield* ctx.playCard(card);
  },
};
```

`src/cards/effects/index.ts`:
```ts
import type { CardId } from '../../engine/types';
import type { Effect } from '../types';
import { HAND_EFFECTS } from './hand';
import { SIMPLE_EFFECTS } from './simple';
import { TRANSFORM_EFFECTS } from './transform';

export const EFFECTS: Record<CardId, Effect> = {
  ...SIMPLE_EFFECTS,
  ...HAND_EFFECTS,
  ...TRANSFORM_EFFECTS,
};
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/cards
git commit -m "feat: add Remodel, Mine, Artisan and Throne Room" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Attack cards and Moat reactions

**Files:**
- Create: `src/cards/effects/attacks.ts`
- Modify: `src/cards/effects/index.ts`
- Test: `src/cards/effects/attacks.test.ts`

**Interfaces:**
- Consumes: `EffectContext.attackedOpponents()` (Task 3), `Game`, testkit.
- Produces: `ATTACK_EFFECTS` (militia, witch, bandit, bureaucrat).

- [ ] **Step 1: Write the failing tests**

`src/cards/effects/attacks.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../../engine/game';
import { answerCards, answerOption, newState, setZones } from '../../engine/testkit';
import type { CardId } from '../../engine/types';

const COPPERS: CardId[] = ['copper', 'copper', 'copper', 'copper', 'copper'];

/** 3-player game. Player 0 has `card` at hand index 0; opponents get the given hands and decks. */
function attack(card: CardId, opp: { hand: CardId[]; deck?: CardId[] }[]): Game {
  const state = newState({ players: 3 });
  setZones(state, 0, { hand: [card, 'estate', 'estate', 'estate', 'estate'], deck: Array(5).fill('estate'), discard: [] });
  opp.forEach((o, i) => setZones(state, i + 1, { hand: o.hand, deck: o.deck ?? [], discard: [] }));
  const g = new Game(state);
  expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({ ok: true });
  return g;
}

describe('Militia', () => {
  it('makes each other player discard down to 3', () => {
    const g = attack('militia', [{ hand: COPPERS }, { hand: ['copper', 'copper', 'copper'] }]);
    expect(g.state.turn.coins).toBe(2);
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', player: 1, min: 2, max: 2 });
    expect(g.apply('p0', answerCards([0, 1]))).toEqual({ ok: false, reason: 'It is not your choice to make' });
    g.apply('p1', answerCards([0, 1]));
    expect(g.state.players[1].hand).toHaveLength(3);
    expect(g.state.players[1].discard).toEqual(['copper', 'copper']);
    expect(g.state.pending).toBeNull();
  });

  it('is blocked by a revealed Moat', () => {
    const g = attack('militia', [{ hand: ['moat', ...COPPERS.slice(1)] }, { hand: COPPERS }]);
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', player: 1 });
    g.apply('p1', answerOption(0));
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', player: 2 });
    g.apply('p2', answerCards([0, 1]));
    expect(g.state.players[1].hand).toHaveLength(5);
    expect(g.state.players[2].hand).toHaveLength(3);
  });

  it('still hits a player who does not reveal Moat', () => {
    const g = attack('militia', [{ hand: ['moat', ...COPPERS.slice(1)] }, { hand: ['copper'] }]);
    g.apply('p1', answerOption(1));
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', player: 1, min: 2, max: 2 });
  });
});

describe('Witch', () => {
  it('draws 2 and gives each other player a Curse', () => {
    const g = attack('witch', [{ hand: COPPERS }, { hand: COPPERS }]);
    expect(g.state.players[0].hand).toHaveLength(6);
    expect(g.state.players[1].discard).toEqual(['curse']);
    expect(g.state.players[2].discard).toEqual(['curse']);
    expect(g.state.supply.curse).toBe(18);
  });

  it('stops giving Curses when the pile runs out', () => {
    const state = newState({ players: 3 });
    state.supply.curse = 1;
    setZones(state, 0, { hand: ['witch'], deck: ['estate', 'estate'], discard: [] });
    const g = new Game(state);
    g.apply('p0', { type: 'playAction', handIndex: 0 });
    expect(g.state.players[1].discard).toContain('curse');
    expect(g.state.players[2].discard).not.toContain('curse');
  });
});

describe('Bandit', () => {
  it('gains a Gold and trashes non-Copper Treasures from the top of each deck', () => {
    const g = attack('bandit', [
      { hand: COPPERS, deck: ['gold', 'copper'] },
      { hand: COPPERS, deck: ['silver', 'gold'] },
    ]);
    expect(g.state.players[0].discard).toEqual(['gold']);
    expect(g.state.players[1].discard).toEqual(['copper']);
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', player: 2, cards: ['silver', 'gold'], selectable: [0, 1] });
    g.apply('p2', answerCards([0]));
    expect(g.state.trash).toEqual(['gold', 'silver']);
    expect(g.state.players[2].discard).toEqual(['gold']);
  });
});

describe('Bureaucrat', () => {
  it('topdecks a Silver and makes others topdeck a Victory card', () => {
    const g = attack('bureaucrat', [
      { hand: ['estate', 'duchy', 'copper', 'copper', 'copper'] },
      { hand: COPPERS },
    ]);
    expect(g.state.players[0].deck[0]).toBe('silver');
    expect(g.state.pending).toMatchObject({ kind: 'chooseCards', player: 1, selectable: [0, 1], min: 1, max: 1 });
    g.apply('p1', answerCards([1]));
    expect(g.state.players[1].deck[0]).toBe('duchy');
    expect(g.state.players[1].hand).toHaveLength(4);
    expect(g.state.log.some((l) => l.player === 2 && l.text === 'reveals a hand with no Victory cards')).toBe(true);
  });

  it('topdecks automatically when there is only one Victory card', () => {
    const g = attack('bureaucrat', [{ hand: ['estate', 'copper'] }, { hand: COPPERS }]);
    expect(g.state.players[1].deck[0]).toBe('estate');
    expect(g.state.pending).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cards/effects/attacks.test.ts`
Expected: FAIL. The cards have no effects yet.

- [ ] **Step 3: Implement the effects**

`src/cards/effects/attacks.ts`:
```ts
import type { CardId } from '../../engine/types';
import type { Effect } from '../types';

export const ATTACK_EFFECTS: Record<CardId, Effect> = {
  *militia(ctx) {
    ctx.addCoins(2);
    const victims = yield* ctx.attackedOpponents();
    for (const opp of victims) {
      const n = ctx.state.players[opp].hand.length - 3;
      if (n <= 0) continue;
      const picked = yield* ctx.chooseFromHand(opp, { min: n, max: n, message: `Discard ${n} card(s), down to 3` });
      ctx.discardFromHand(opp, picked);
    }
  },
  *witch(ctx) {
    ctx.draw(ctx.me, 2);
    const victims = yield* ctx.attackedOpponents();
    for (const opp of victims) ctx.gain(opp, 'curse');
  },
  *bandit(ctx) {
    ctx.gain(ctx.me, 'gold');
    const victims = yield* ctx.attackedOpponents();
    for (const opp of victims) {
      const revealed = ctx.takeFromDeck(opp, 2);
      if (revealed.length === 0) continue;
      ctx.log(opp, 'reveals', revealed);
      const targets = revealed
        .map((_, i) => i)
        .filter((i) => ctx.isType(revealed[i], 'treasure') && revealed[i] !== 'copper');
      const picked = yield* ctx.chooseCards(opp, revealed, {
        min: 1, max: 1, selectable: targets, message: 'Trash a revealed Treasure',
      });
      ctx.trashCards(opp, picked.map((i) => revealed[i]));
      ctx.discardCards(opp, revealed.filter((_, i) => !picked.includes(i)));
    }
  },
  *bureaucrat(ctx) {
    ctx.gain(ctx.me, 'silver', 'deck');
    const victims = yield* ctx.attackedOpponents();
    for (const opp of victims) {
      const hand = ctx.state.players[opp].hand;
      const picked = yield* ctx.chooseFromHand(opp, {
        min: 1, max: 1, message: 'Put a Victory card from your hand onto your deck', filter: (c) => ctx.isType(c, 'victory'),
      });
      if (picked.length === 0) {
        ctx.log(opp, 'reveals a hand with no Victory cards', hand);
        continue;
      }
      ctx.log(opp, 'reveals', [hand[picked[0]]]);
      ctx.topdeckFromHand(opp, picked[0]);
    }
  },
};
```

`src/cards/effects/index.ts`:
```ts
import type { CardId } from '../../engine/types';
import type { Effect } from '../types';
import { ATTACK_EFFECTS } from './attacks';
import { HAND_EFFECTS } from './hand';
import { SIMPLE_EFFECTS } from './simple';
import { TRANSFORM_EFFECTS } from './transform';

export const EFFECTS: Record<CardId, Effect> = {
  ...SIMPLE_EFFECTS,
  ...HAND_EFFECTS,
  ...TRANSFORM_EFFECTS,
  ...ATTACK_EFFECTS,
};
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/cards
git commit -m "feat: add Militia, Witch, Bandit, Bureaucrat with Moat reactions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Library and Sentry

**Files:**
- Create: `src/cards/effects/look.ts`
- Modify: `src/cards/effects/index.ts`
- Test: `src/cards/effects/look.test.ts`

**Interfaces:**
- Consumes: `EffectContext`, `Game`, testkit.
- Produces: `LOOK_EFFECTS` (library, sentry). After this task, every kingdom card with an effect has one.

- [ ] **Step 1: Write the failing tests**

`src/cards/effects/look.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../../engine/game';
import { answerOption, answerOrder, newState, setZones } from '../../engine/testkit';
import type { CardId } from '../../engine/types';
import { KINGDOM_IDS, getCard } from '../registry';

function play(hand: CardId[], deck: CardId[], discard: CardId[] = []): Game {
  const state = newState();
  setZones(state, 0, { hand, deck, discard });
  const g = new Game(state);
  expect(g.apply('p0', { type: 'playAction', handIndex: 0 })).toEqual({ ok: true });
  return g;
}

describe('Library', () => {
  it('draws to 7, letting the player set aside Actions', () => {
    const g = play(
      ['library', 'estate', 'estate', 'estate', 'estate'],
      ['village', 'copper', 'smithy', 'copper', 'gold'],
    );
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', cards: ['village'] });
    g.apply('p0', answerOption(0)); // set Village aside
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', cards: ['smithy'] });
    g.apply('p0', answerOption(1)); // keep Smithy
    expect(g.state.pending).toBeNull();
    expect(g.state.players[0].hand).toEqual(['estate', 'estate', 'estate', 'estate', 'copper', 'smithy', 'copper']);
    expect(g.state.players[0].discard).toEqual(['village']);
    expect(g.state.players[0].deck).toEqual(['gold']);
  });

  it('stops when there is nothing left to draw', () => {
    const g = play(['library', 'estate'], ['copper']);
    expect(g.state.players[0].hand).toEqual(['estate', 'copper']);
    expect(g.state.pending).toBeNull();
  });
});

describe('Sentry', () => {
  it('trashes, discards or keeps each of the top 2 cards', () => {
    const g = play(['sentry', 'estate'], ['copper', 'curse', 'gold', 'silver']);
    expect(g.state.turn.actions).toBe(1);
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', cards: ['curse'], options: ['Trash', 'Discard', 'Put back'] });
    g.apply('p0', answerOption(0));
    expect(g.state.pending).toMatchObject({ kind: 'chooseOption', cards: ['gold'] });
    g.apply('p0', answerOption(2));
    expect(g.state.pending).toBeNull();
    expect(g.state.trash).toEqual(['curse']);
    expect(g.state.players[0].deck).toEqual(['gold', 'silver']);
  });

  it('lets the player order the kept cards', () => {
    const g = play(['sentry', 'estate'], ['copper', 'gold', 'silver', 'estate']);
    g.apply('p0', answerOption(2));
    g.apply('p0', answerOption(2));
    expect(g.state.pending).toMatchObject({ kind: 'orderCards', cards: ['gold', 'silver'] });
    g.apply('p0', answerOrder([1, 0]));
    expect(g.state.players[0].deck).toEqual(['silver', 'gold', 'estate']);
  });
});

describe('effect coverage', () => {
  it('every kingdom Action card has an effect', () => {
    const missing = KINGDOM_IDS.filter((id) => getCard(id).types.includes('action') && !getCard(id).play);
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cards/effects/look.test.ts`
Expected: FAIL. Library and Sentry have no effects, and coverage lists `['library', 'sentry']`.

- [ ] **Step 3: Implement the effects**

`src/cards/effects/look.ts`:
```ts
import type { CardId } from '../../engine/types';
import type { Effect } from '../types';

export const LOOK_EFFECTS: Record<CardId, Effect> = {
  *library(ctx) {
    const setAside: CardId[] = [];
    while (ctx.state.players[ctx.me].hand.length < 7) {
      const [card] = ctx.takeFromDeck(ctx.me, 1);
      if (card === undefined) break;
      if (ctx.isType(card, 'action')) {
        const choice = yield* ctx.chooseOption(ctx.me, 'You drew an Action card. Set it aside?', ['Set it aside', 'Keep it'], [card]);
        if (choice === 0) {
          setAside.push(card);
          continue;
        }
      }
      ctx.state.players[ctx.me].hand.push(card);
    }
    ctx.discardCards(ctx.me, setAside);
  },
  *sentry(ctx) {
    ctx.draw(ctx.me, 1);
    ctx.addActions(1);
    const looked = ctx.takeFromDeck(ctx.me, 2);
    const kept: CardId[] = [];
    for (const card of looked) {
      const choice = yield* ctx.chooseOption(ctx.me, 'What do you do with this card?', ['Trash', 'Discard', 'Put back'], [card]);
      if (choice === 0) ctx.trashCards(ctx.me, [card]);
      else if (choice === 1) ctx.discardCards(ctx.me, [card]);
      else kept.push(card);
    }
    const ordered = yield* ctx.orderCards(ctx.me, kept, 'Order the cards to put back (first = top of deck)');
    ctx.putOnDeck(ctx.me, ordered);
  },
};
```

`src/cards/effects/index.ts`:
```ts
import type { CardId } from '../../engine/types';
import type { Effect } from '../types';
import { ATTACK_EFFECTS } from './attacks';
import { HAND_EFFECTS } from './hand';
import { LOOK_EFFECTS } from './look';
import { SIMPLE_EFFECTS } from './simple';
import { TRANSFORM_EFFECTS } from './transform';

export const EFFECTS: Record<CardId, Effect> = {
  ...SIMPLE_EFFECTS,
  ...HAND_EFFECTS,
  ...TRANSFORM_EFFECTS,
  ...ATTACK_EFFECTS,
  ...LOOK_EFFECTS,
};
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/cards
git commit -m "feat: add Library and Sentry; all kingdom cards implemented" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Player views

**Files:**
- Create: `src/engine/view.ts`
- Test: `src/engine/view.test.ts`

**Interfaces:**
- Consumes: `GameState`, types, `Game` and testkit (tests only).
- Produces:
```ts
interface PublicPlayer { id: string; name: string; handCount: number; deckCount: number; discardCount: number; discardTop: CardId | null; inPlay: CardId[] }
interface PlayerView {
  you: number;
  players: PublicPlayer[];
  hand: CardId[];
  supply: Record<CardId, number>;
  kingdom: CardId[];
  trash: CardId[];
  turn: TurnState;
  prompt: Prompt | null;                                  // only when the prompt is yours
  waitingOn: { player: number; message: string } | null;  // set when someone else must choose
  log: LogEntry[];
  result: GameResult | null;
}
function viewFor(state: GameState, playerId: string): PlayerView
```

- [ ] **Step 1: Write the failing test**

`src/engine/view.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Game } from './game';
import { newState, setZones } from './testkit';
import { viewFor } from './view';

describe('viewFor', () => {
  it('shows your hand and only counts for opponents', () => {
    const s = newState();
    setZones(s, 0, { hand: ['copper', 'estate'], deck: ['gold'], discard: ['silver', 'duchy'], inPlay: [] });
    // Witch is not in TEST_KINGDOM, so it can only leak into the view through p1's hand.
    setZones(s, 1, { hand: ['witch', 'witch', 'witch'], deck: [], discard: [], inPlay: [] });
    const v = viewFor(s, 'p0');
    expect(v.you).toBe(0);
    expect(v.hand).toEqual(['copper', 'estate']);
    expect(v.players[0]).toEqual({
      id: 'p0', name: 'P0', handCount: 2, deckCount: 1, discardCount: 2, discardTop: 'duchy', inPlay: [],
    });
    expect(v.players[1]).toMatchObject({ handCount: 3, discardTop: null });
    expect(JSON.stringify(v)).not.toContain('witch');
    expect(v.supply.copper).toBe(s.supply.copper);
  });

  it('shows a prompt only to the player who must answer it', () => {
    const s = newState({ players: 3 });
    setZones(s, 0, { hand: ['militia'], deck: [], discard: [] });
    setZones(s, 1, { hand: ['gold', 'gold', 'gold', 'gold', 'gold'], deck: [], discard: [] });
    const g = new Game(s);
    g.apply('p0', { type: 'playAction', handIndex: 0 });

    const mine = viewFor(g.state, 'p1');
    expect(mine.prompt).toMatchObject({ kind: 'chooseCards', player: 1 });
    expect(mine.waitingOn).toBeNull();

    const theirs = viewFor(g.state, 'p0');
    expect(theirs.prompt).toBeNull();
    expect(theirs.waitingOn).toEqual({ player: 1, message: 'Discard 2 card(s), down to 3' });
  });

  it('returns a copy that cannot change the game', () => {
    const s = newState();
    const v = viewFor(s, 'p0');
    v.hand.push('gold');
    v.supply.copper = 0;
    expect(s.players[0].hand).toHaveLength(5);
    expect(s.supply.copper).toBe(46);
  });

  it('rejects unknown players', () => {
    expect(() => viewFor(newState(), 'zz')).toThrow('Unknown player: zz');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/view.test.ts`
Expected: FAIL, cannot resolve `./view`.

- [ ] **Step 3: Implement views**

`src/engine/view.ts`:
```ts
import type { CardId, GameResult, GameState, LogEntry, Prompt, TurnState } from './types';

export interface PublicPlayer {
  id: string;
  name: string;
  handCount: number;
  deckCount: number;
  discardCount: number;
  discardTop: CardId | null;
  inPlay: CardId[];
}

export interface PlayerView {
  you: number;
  players: PublicPlayer[];
  hand: CardId[];
  supply: Record<CardId, number>;
  kingdom: CardId[];
  trash: CardId[];
  turn: TurnState;
  /** The pending prompt, only when this player must answer it. */
  prompt: Prompt | null;
  /** Set when another player must answer a prompt. */
  waitingOn: { player: number; message: string } | null;
  log: LogEntry[];
  result: GameResult | null;
}

export function viewFor(state: GameState, playerId: string): PlayerView {
  const you = state.players.findIndex((p) => p.id === playerId);
  if (you < 0) throw new Error(`Unknown player: ${playerId}`);
  const pending = state.pending;
  const view: PlayerView = {
    you,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      deckCount: p.deck.length,
      discardCount: p.discard.length,
      discardTop: p.discard.length > 0 ? p.discard[p.discard.length - 1] : null,
      inPlay: p.inPlay,
    })),
    hand: state.players[you].hand,
    supply: state.supply,
    kingdom: state.kingdom,
    trash: state.trash,
    turn: state.turn,
    prompt: pending && pending.player === you ? pending : null,
    waitingOn: pending && pending.player !== you ? { player: pending.player, message: pending.message } : null,
    log: state.log,
    result: state.result,
  };
  return structuredClone(view);
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine
git commit -m "feat: add per-player views that hide private information" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Big Money bot and 200-game simulation

**Files:**
- Create: `src/sim/bigMoney.ts`
- Test: `src/sim/simulation.test.ts`

**Interfaces:**
- Consumes: `Game`, `createGame` options, `getCard`, `isType`, `KINGDOM_IDS`, `ownedCards`, `createRng`, `shuffle`.
- Produces: `defaultAnswer(prompt: Prompt): PromptAnswer`, `botMove(game: Game): { playerId: string; intent: Intent }`.

- [ ] **Step 1: Write the failing simulation test**

`src/sim/simulation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { KINGDOM_IDS } from '../cards/registry';
import { Game } from '../engine/game';
import { createRng, shuffle } from '../engine/rng';
import type { GameState } from '../engine/types';
import { ownedCards } from '../engine/zones';
import { botMove } from './bigMoney';

function totalCards(s: GameState): number {
  const owned = s.players.reduce((n, p) => n + ownedCards(p).length, 0);
  const supply = Object.values(s.supply).reduce((a, b) => a + b, 0);
  return owned + supply + s.trash.length;
}

function runGame(seed: number): Game {
  const players = 2 + (seed % 3);
  const kingdom = shuffle(createRng(seed), KINGDOM_IDS).slice(0, 10);
  const game = Game.create({
    players: Array.from({ length: players }, (_, i) => ({ id: `p${i}`, name: `Bot ${i}` })),
    kingdom,
    seed,
  });
  const expected = totalCards(game.state);
  for (let step = 0; step < 20000 && !game.state.result; step++) {
    const { playerId, intent } = botMove(game);
    const res = game.apply(playerId, intent);
    if (!res.ok) throw new Error(`seed ${seed}: illegal bot move ${JSON.stringify(intent)}: ${res.reason}`);
    if (!game.state.pending && totalCards(game.state) !== expected) {
      throw new Error(`seed ${seed}: card count changed at step ${step}`);
    }
  }
  return game;
}

describe('simulation', () => {
  it('200 Big Money games on random kingdoms all finish with cards conserved', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const game = runGame(seed);
      expect(game.state.result, `seed ${seed} did not finish`).not.toBeNull();
      expect(game.state.result!.winners.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sim`
Expected: FAIL, cannot resolve `./bigMoney`.

- [ ] **Step 3: Implement the bot**

`src/sim/bigMoney.ts`:
```ts
import { getCard, isType } from '../cards/registry';
import type { Game } from '../engine/game';
import type { CardId, Intent, Prompt, PromptAnswer } from '../engine/types';

/** The simplest legal answer to any prompt. */
export function defaultAnswer(prompt: Prompt): PromptAnswer {
  switch (prompt.kind) {
    case 'chooseCards':
      return { kind: 'cards', indices: prompt.selectable.slice(0, prompt.min) };
    case 'chooseSupply': {
      if (prompt.optional) return { kind: 'supply', card: null };
      const best = [...prompt.piles].sort((a, b) => getCard(b).cost - getCard(a).cost)[0];
      return { kind: 'supply', card: best };
    }
    case 'chooseOption':
      return { kind: 'option', index: 0 };
    case 'orderCards':
      return { kind: 'order', order: prompt.cards.map((_, i) => i) };
  }
}

/** Big Money: play any Action, play all Treasures, buy Province/Gold/Silver. */
export function botMove(game: Game): { playerId: string; intent: Intent } {
  const s = game.state;
  if (s.pending) {
    return {
      playerId: s.players[s.pending.player].id,
      intent: { type: 'answerPrompt', answer: defaultAnswer(s.pending) },
    };
  }
  const p = s.players[s.turn.player];
  const t = s.turn;
  const move = (intent: Intent) => ({ playerId: p.id, intent });

  if (t.phase === 'action' && t.actions > 0) {
    const i = p.hand.findIndex((c) => isType(c, 'action'));
    if (i >= 0) return move({ type: 'playAction', handIndex: i });
  }
  if (!t.boughtThisTurn && p.hand.some((c) => isType(c, 'treasure'))) {
    return move({ type: 'playAllTreasures' });
  }
  if (t.buys > 0) {
    const want: CardId | null = t.coins >= 8 ? 'province' : t.coins >= 6 ? 'gold' : t.coins >= 3 ? 'silver' : null;
    if (want && s.supply[want] > 0) return move({ type: 'buy', card: want });
  }
  return move({ type: 'endPhase' });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS (all suites), typecheck clean. If a seed fails, the error names it. Reproduce with that seed and fix the engine bug, not the test.

- [ ] **Step 5: Commit**

```bash
git add src/sim
git commit -m "test: add Big Money bot and 200-game simulation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Spec coverage (self-review)

| Spec section | Task |
|---|---|
| §3.1 Setup and supply counts | 2 |
| §3.2 Turn phases, Treasure lock after buying, reshuffle | 2, 3 |
| §3.3 End conditions, scoring, tie-break | 2, 3 |
| §3.4 All 26 kingdom cards and rules details | 3–7 (coverage test in 7) |
| §5.1 State | 1 |
| §5.2 Intents, illegal intents leave state unchanged | 3 |
| §5.3 Generator effects, prompts, Moat | 3, 6 |
| §5.4 Views and hidden information | 8 |
| §8 Card, interaction, rules and simulation tests | 2–9 |
| §6 Networking, §7 UI | **Plan 2** |

Deviations from the spec, both small:
- `TurnState.phase` has no `'cleanup'` value, because cleanup happens instantly inside `endPhase`.
- Per-turn flags are typed fields (`merchants`, `silverPlayed`) rather than a generic record.

## Next

Plan 2, Networking & UI, will build on `Game`, `viewFor`, `Intent` and `PlayerView`: PeerJS host and guests, the lobby, the board, prompts, theming, and the GitHub Pages deploy.
