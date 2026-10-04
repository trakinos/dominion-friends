# Dominion Friends — Plan 2: Networking & UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the finished rules engine playable by 2–4 friends in their browsers. One player hosts from their own tab and shares a room code or link; the others join over peer-to-peer WebRTC.

**Architecture:**
- **Host:** the host's browser runs a `HostSession`. It owns the seats, the lobby and the engine's `Game`. Every message from a guest is validated, applied through `Game.apply`, and answered with a fresh `viewFor` view for each player.
- **Players:** every player, the host included, uses a `GuestSession` over a `Connection`. Remote guests connect through PeerJS. The host's own UI uses an in-memory connection, so there is a single code path.
- **Interface:** React renders the `GuestSession` state.
- **Testing:** networking logic is tested over an in-memory transport. PeerJS is a thin adapter that is checked by hand.

**Tech Stack:**
- React 19, Vite (already installed), TypeScript, Vitest
- PeerJS 1.x, using the free public PeerJS broker for signaling only
- GitHub Pages for the static deploy

**Spec:** `docs/superpowers/specs/2026-10-04-dominion-friends-design.md` (§6 networking, §7 UI)
**Builds on:** Plan 1 (`src/engine`, `src/cards`, `src/sim`), which is merged to `main`.

## Global Constraints

- **Engine API is fixed.** Consume `Game` (`Game.create`, `apply(playerId, intent)`, `state`), `viewFor(state, playerId)`, and the `Intent`, `PlayerView`, `Prompt`, `PromptAnswer` and `LogEntry` types. Do not modify `src/engine` or `src/cards`. If a change seems necessary, stop and report it.
- **Layering:** `src/net` may import from `engine` and `cards`, but never from `ui`. `src/ui` may import from everything.
- **Room codes:** 4 characters from the alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. The PeerJS id is `dmf-<code>` and the share link is `<page url>#join=<code>`.
- **Players and joining:** 2–4 players. Joining is refused with `'Room full'` when 4 are seated, and with `'Game in progress'` when an unknown player tries to join a running game.
- **Host authority:** guests never change game state. The host validates every message, wraps `game.apply` in try/catch, and sends refused moves back only to the sender as `{ type: 'error', reason }`.
- **Layout:** desktop first. Below 768px the hand scrolls horizontally and Hand, Supply and Log become tabs. Colors are CSS custom properties with a dark-mode override, and `body` has an explicit background.
- **Randomness:** no `Math.random()` inside `engine/` or `cards/`. Code in `net/` takes an injectable `random` so tests are deterministic.
- **Commits:** every commit message ends with a second `-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- **Verification after every task:** `npm test && npm run typecheck && npm run build` all pass. `build` is added in Task 1.

**Deliberate deviations from spec §6:**
- There is no `ended` message; the result arrives inside `view.result`. There is no `ping` message either, but both PeerJS ends run a heartbeat (`__hb` frames every 4s, closing after 12s of silence), because a closed tab or dropped network does not fire the DataConnection `close` event.
- Guests connect with binary serialization, which chunks large messages (JSON channels refuse messages of 16300 bytes or more). Each view also carries only the last 150 log entries (`MAX_LOG_ENTRIES`).
- When a guest loses the host, the UI shows a neutral "Connection lost" screen with a Rejoin button instead of "Host disconnected — game over", since the host may only have dropped briefly.
- `GuestSession` has an `awaiting` guard: it ignores further intents between sending one and receiving the host's reply (view, error or lobby), so double clicks cannot send stale moves.
- The host sees an "End game" button during play (with a confirm) so a game stuck on an offline player can be ended.
- A guest who disconnects during the lobby loses their seat. Seats are only kept, as offline, once the game has started.
- The host's own seat token lives only in memory, because the game ends when the host leaves anyway.

## File Map

```
index.html, vite.config.ts, .claude/launch.json, .github/workflows/deploy.yml
src/main.tsx                 React entry
src/vite-env.d.ts            Vite client types (CSS imports)
src/styles.css               design tokens + all layout/card styles
src/theme/index.ts           placeholder card names (PLACEHOLDER_NAMES, cardName)
src/net/
  transport.ts               Connection interface
  memory.ts                  in-memory connection pair + flush() for tests
  roomCode.ts                codes, peer ids, share links, #join parsing
  protocol.ts                message types, LobbyState, message parsing/validation
  errors.ts                  describePeerError: friendly connection errors
  host.ts                    HostSession: seats, lobby, game, broadcasting
  testing.ts                 test helpers (seeded options, fake clients)
  guest.ts                   GuestSession + token stores
  peer.ts                    PeerJS adapter (host peer, connect to host)
src/ui/
  connect.ts                 hostGame / joinGame → ActiveSession
  useGuestState.ts           React hook over GuestSession
  storage.ts                 remembered player name
  moves.ts                   what's playable/buyable, supply ordering
  format.ts                  log line formatting
  promptSelection.ts         selection logic for card prompts
  App.tsx                    screen routing
  components/  Card, Centered, Supply, Hand, Opponents, TurnBar, Log, PromptPanel, KingdomPicker
  screens/     Home, Lobby, Board, EndScreen
```

---

### Task 1: Tooling, theme names and app shell

**Files:**
- Modify: `package.json`, `tsconfig.json`
- Create: `vite.config.ts`, `index.html`, `src/main.tsx`, `src/vite-env.d.ts`, `src/styles.css`, `src/ui/App.tsx`, `src/theme/index.ts`, `.claude/launch.json`
- Test: `src/theme/theme.test.ts`

**Interfaces:**
- Produces: `PLACEHOLDER_NAMES: Record<CardId, string>` and `cardName(id: CardId): string`, which falls back to the id. Also a placeholder `App` component that Task 8 replaces, and the full stylesheet that later tasks only reference.

- [ ] **Step 1: Install dependencies**

Run: `npm install react react-dom peerjs`
Run: `npm install -D @vitejs/plugin-react @types/react @types/react-dom`
Expected: installs without errors.

If `@vitejs/plugin-react` fails with a peer-dependency conflict against the installed Vite, do not force it. Uninstall it, delete the `react()` plugin from `vite.config.ts` in Step 3 (Vite compiles TSX itself, using `jsx: react-jsx` from tsconfig), and note this in your report.

- [ ] **Step 2: Update `package.json` scripts and `tsconfig.json`**

Set the `scripts` block of `package.json` to:
```json
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
```

In `tsconfig.json`, add `"jsx": "react-jsx"` to `compilerOptions` and leave everything else as is.

- [ ] **Step 3: Create the Vite entry files**

`vite.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works from a GitHub Pages sub-path.
  base: './',
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dominion Friends</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/ui/App.tsx` (placeholder; Task 8 replaces it):
```tsx
export function App() {
  return (
    <main className="centered">
      <h1>Dominion Friends</h1>
    </main>
  );
}
```

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev", "--", "--port", "5173", "--strictPort"],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 4: Create the stylesheet**

`src/styles.css`:
```css
:root {
  --bg: #f5f2ea;
  --surface: #ffffff;
  --surface-2: #ece7da;
  --text: #1f1c15;
  --muted: #6d6758;
  --border: #d8d1bf;
  --accent: #2b62c9;
  --accent-text: #ffffff;
  --danger: #b3261e;
  --online: #2e8b57;
  --t-action: #e9e3d1;
  --t-treasure: #f2d36b;
  --t-victory: #a6d68f;
  --t-curse: #b996dc;
  --t-attack: #eaa48f;
  --t-reaction: #92c4ea;
  --radius: 10px;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16140f;
    --surface: #211e17;
    --surface-2: #2b271e;
    --text: #efe9da;
    --muted: #a59d89;
    --border: #3a3428;
    --accent: #6c9cf0;
    --accent-text: #0d1220;
    --danger: #ff8a80;
    --online: #5cc98a;
    --t-action: #4a4535;
    --t-treasure: #7a6420;
    --t-victory: #3f6a33;
    --t-curse: #57407a;
    --t-attack: #7a3f30;
    --t-reaction: #2f5a7a;
    color-scheme: dark;
  }
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
}
button {
  font: inherit;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
button:disabled { cursor: default; opacity: 0.55; }
button.primary { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
input {
  font: inherit;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
h1, h2, h3 { margin: 0 0 8px; }
h2 { font-size: 1.05rem; }
h3 { font-size: 0.9rem; color: var(--muted); font-weight: 600; }
.muted { color: var(--muted); }
.error { color: var(--danger); }

/* Screens */
.screen { max-width: 960px; margin: 0 auto; padding: 24px 16px; display: grid; gap: 16px; }
.centered { min-height: 100vh; display: grid; place-content: center; gap: 12px; text-align: center; padding: 16px; }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.field { display: grid; gap: 4px; max-width: 320px; }
.home__choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.home__choices .panel { display: grid; gap: 10px; align-content: start; }
.lobby__header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.share { display: flex; gap: 8px; }
.share input { flex: 1; min-width: 0; }
.seats { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--border); margin-right: 6px; }
.dot--on { background: var(--online); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.picker__bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px; }
.card-row { display: flex; flex-wrap: wrap; gap: 8px; }
.table-wrap { overflow-x: auto; }

/* Cards */
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 112px;
  min-height: 150px;
  padding: 8px;
  text-align: left;
  border-radius: 8px;
  border: 2px solid transparent;
  background: var(--t-action);
  color: var(--text);
  cursor: default;
}
.card:disabled { opacity: 1; }
.card.is-clickable { cursor: pointer; }
.card--small { width: 84px; min-height: 0; }
.card--treasure { background: var(--t-treasure); }
.card--victory { background: var(--t-victory); }
.card--curse { background: var(--t-curse); }
.card--attack { background: var(--t-attack); }
.card--reaction { background: var(--t-reaction); }
.card__cost { position: absolute; top: 6px; right: 8px; font-weight: 700; font-size: 0.8rem; }
.card__name { font-weight: 700; padding-right: 24px; }
.card__text { font-size: 0.72rem; line-height: 1.25; flex: 1; }
.card__types { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.card__badge {
  position: absolute;
  bottom: 6px;
  right: 8px;
  min-width: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: var(--surface);
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
}
.card.is-highlight { border-color: var(--accent); }
.card.is-selected { border-color: var(--accent); transform: translateY(-4px); }
.card.is-dimmed { opacity: 0.45; }

/* Board */
.board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  grid-template-areas:
    "supply supply"
    "opponents opponents"
    "play log"
    "turn turn"
    "hand hand";
  gap: 12px;
  padding: 12px 16px;
  max-width: 1280px;
  margin: 0 auto;
}
.board__tabs { display: none; }
.board__supply { grid-area: supply; }
.board__opponents { grid-area: opponents; }
.board__play { grid-area: play; }
.board__log { grid-area: log; }
.board__turn { grid-area: turn; display: grid; gap: 8px; }
.board__hand { grid-area: hand; }
.supply { display: grid; gap: 8px; }
.supply__basics, .supply__kingdom { display: flex; flex-wrap: wrap; gap: 8px; }
.opponents { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.opponents li {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.opponents li.is-current { border-color: var(--accent); }
.log {
  margin: 0;
  padding: 8px 8px 8px 28px;
  height: 220px;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.85rem;
}
.turnbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 12px;
}
.turnbar__phase { color: var(--muted); }
.banner { padding: 8px 12px; border-radius: var(--radius); background: var(--surface-2); }
.toast {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--danger);
}
.hand { display: flex; flex-wrap: wrap; gap: 8px; }
.piles { margin-top: 6px; font-size: 0.85rem; }
.overlay { position: fixed; inset: 0; background: rgb(0 0 0 / 0.45); display: grid; place-items: center; padding: 16px; z-index: 10; }
.prompt { max-width: 720px; width: 100%; max-height: 90vh; overflow-y: auto; display: grid; gap: 12px; }
.scores { width: 100%; border-collapse: collapse; background: var(--surface); }
.scores th, .scores td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
.scores tr.is-winner td { font-weight: 700; }

@media (max-width: 767px) {
  .board {
    grid-template-columns: 1fr;
    grid-template-areas: "tabs" "opponents" "turn" "play" "supply" "log" "hand";
    padding: 8px 16px;
  }
  .board__tabs { display: flex; gap: 8px; grid-area: tabs; }
  .board__tabs button.is-active { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
  .board--tab-hand .board__supply,
  .board--tab-hand .board__log,
  .board--tab-supply .board__hand,
  .board--tab-supply .board__log,
  .board--tab-log .board__hand,
  .board--tab-log .board__supply { display: none; }
  .hand { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 6px; }
  .card { width: 96px; min-height: 132px; }
  .card--small { width: 76px; min-height: 0; }
}
```

- [ ] **Step 5: Write the failing theme test**

`src/theme/theme.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { BASIC_IDS, KINGDOM_IDS } from '../cards/registry';
import { PLACEHOLDER_NAMES, cardName } from '.';

describe('placeholder theme', () => {
  it('names every card, with no duplicates', () => {
    const ids = [...BASIC_IDS, ...KINGDOM_IDS];
    for (const id of ids) expect(PLACEHOLDER_NAMES[id], id).toBeTruthy();
    expect(new Set(ids.map(cardName)).size).toBe(ids.length);
  });

  it('uses the spec placeholder names', () => {
    expect(cardName('smithy')).toBe('Draw Three');
    expect(cardName('throne_room')).toBe('Echo');
    expect(cardName('copper')).toBe('Copper');
  });

  it('falls back to the id for unknown cards', () => {
    expect(cardName('mystery')).toBe('mystery');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/theme`
Expected: FAIL, cannot resolve `.`.

- [ ] **Step 7: Implement the theme**

`src/theme/index.ts`:
```ts
import type { CardId } from '../engine/types';

/** Display names used until a real theme is chosen (spec §3.4). */
export const PLACEHOLDER_NAMES: Record<CardId, string> = {
  copper: 'Copper',
  silver: 'Silver',
  gold: 'Gold',
  estate: 'Estate',
  duchy: 'Duchy',
  province: 'Province',
  curse: 'Curse',
  cellar: 'Sift',
  chapel: 'Purge',
  moat: 'Shield',
  harbinger: 'Recall',
  merchant: 'Trader',
  vassal: 'Servant',
  village: 'Village',
  workshop: 'Workshop',
  bureaucrat: 'Clerk',
  gardens: 'Garden',
  militia: 'Raiders',
  moneylender: 'Lender',
  poacher: 'Scavenger',
  remodel: 'Rebuild',
  smithy: 'Draw Three',
  throne_room: 'Echo',
  bandit: 'Thief',
  council_room: 'Council',
  festival: 'Festival',
  laboratory: 'Lab',
  library: 'Archive',
  market: 'Market',
  mine: 'Refinery',
  sentry: 'Sentry',
  witch: 'Hex',
  artisan: 'Artisan',
};

export function cardName(id: CardId): string {
  return Object.hasOwn(PLACEHOLDER_NAMES, id) ? PLACEHOLDER_NAMES[id] : id;
}
```

- [ ] **Step 8: Verify tests, typecheck and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass (95 total), typecheck is clean, and `dist/` is produced. `dist` is already in `.gitignore`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .claude/launch.json src/main.tsx src/vite-env.d.ts src/styles.css src/ui/App.tsx src/theme
git commit -m "feat: add React/Vite app shell, stylesheet and placeholder card names" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Network primitives: room codes, protocol, memory transport, errors

**Files:**
- Create: `src/net/transport.ts`, `src/net/memory.ts`, `src/net/roomCode.ts`, `src/net/protocol.ts`, `src/net/errors.ts`
- Test: `src/net/memory.test.ts`, `src/net/roomCode.test.ts`, `src/net/protocol.test.ts`, `src/net/errors.test.ts`

**Interfaces:**
- Produces:
  - `interface Connection { send(msg: unknown): void; onMessage(cb: (msg: unknown) => void): void; onClose(cb: () => void): void; close(): void }`
  - `createMemoryPair(): [Connection, Connection]` (asynchronous delivery, JSON copies) and `flush(): Promise<void>`
  - `ROOM_CODE_ALPHABET`, `CODE_LENGTH`, `generateRoomCode(random?)`, `normalizeRoomCode(input): string | null`, `peerIdFor(code)`, `joinLink(base, code)`, `codeFromHash(hash): string | null`
  - `LobbyPlayer`, `LobbyState`, `GuestMessage`, `HostMessage`, `MAX_NAME_LENGTH`, `cleanName(raw)`, `parseGuestMessage(raw)`, `parseHostMessage(raw)`
  - `describePeerError(err: unknown): string`

- [ ] **Step 1: Write the failing tests**

`src/net/memory.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createMemoryPair, flush } from './memory';

describe('memory connection pair', () => {
  it('delivers JSON copies asynchronously in both directions', async () => {
    const [a, b] = createMemoryPair();
    const atB: unknown[] = [];
    const atA: unknown[] = [];
    b.onMessage((m) => atB.push(m));
    a.onMessage((m) => atA.push(m));
    const original = { n: 1, list: [1, 2] };
    a.send(original);
    b.send('pong');
    expect(atB).toEqual([]);
    original.list.push(3);
    await flush();
    expect(atB).toEqual([{ n: 1, list: [1, 2] }]);
    expect(atA).toEqual(['pong']);
  });

  it('closes both ends and stops delivery', async () => {
    const [a, b] = createMemoryPair();
    let closedA = 0;
    let closedB = 0;
    const atB: unknown[] = [];
    a.onClose(() => closedA++);
    b.onClose(() => closedB++);
    b.onMessage((m) => atB.push(m));
    a.send('before');
    a.close();
    a.send('after');
    await flush();
    expect(closedA).toBe(1);
    expect(closedB).toBe(1);
    expect(atB).toEqual([]);
  });
});
```

`src/net/roomCode.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CODE_LENGTH, ROOM_CODE_ALPHABET, codeFromHash, generateRoomCode, joinLink, normalizeRoomCode, peerIdFor } from './roomCode';

describe('room codes', () => {
  it('generates codes from the unambiguous alphabet', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAA');
    expect(generateRoomCode(() => 0.9999)).toBe('9999');
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect([...code].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
    }
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[IL0O1]/);
  });

  it('normalizes typed codes', () => {
    expect(normalizeRoomCode(' abcd ')).toBe('ABCD');
    expect(normalizeRoomCode('ABC')).toBeNull();
    expect(normalizeRoomCode('ABCDE')).toBeNull();
    expect(normalizeRoomCode('AB0D')).toBeNull();
  });

  it('builds peer ids and share links', () => {
    expect(peerIdFor('ABCD')).toBe('dmf-ABCD');
    expect(joinLink('https://x.io/app/', 'ABCD')).toBe('https://x.io/app/#join=ABCD');
  });

  it('reads the code from the URL hash', () => {
    expect(codeFromHash('#join=abcd')).toBe('ABCD');
    expect(codeFromHash('')).toBeNull();
    expect(codeFromHash('#join=??')).toBeNull();
    expect(codeFromHash('#other=ABCD')).toBeNull();
  });
});
```

`src/net/protocol.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { cleanName, parseGuestMessage, parseHostMessage } from './protocol';

describe('cleanName', () => {
  it('trims, limits to 20 characters and defaults to Player', () => {
    expect(cleanName('  Ana  ')).toBe('Ana');
    expect(cleanName('x'.repeat(30))).toBe('x'.repeat(20));
    expect(cleanName('   ')).toBe('Player');
    expect(cleanName(42)).toBe('Player');
  });
});

describe('parseGuestMessage', () => {
  it('parses hello messages', () => {
    expect(parseGuestMessage({ type: 'hello', name: ' Ana ', token: 't1' })).toEqual({ type: 'hello', name: 'Ana', token: 't1' });
    expect(parseGuestMessage({ type: 'hello', name: 'Ana', token: 7 })).toEqual({ type: 'hello', name: 'Ana', token: null });
    expect(parseGuestMessage({ type: 'hello', name: 'Ana', token: 'x'.repeat(65) })).toEqual({ type: 'hello', name: 'Ana', token: null });
  });

  it('passes intents through for the engine to validate', () => {
    expect(parseGuestMessage({ type: 'intent', intent: { type: 'endPhase' } })).toEqual({ type: 'intent', intent: { type: 'endPhase' } });
    expect(parseGuestMessage({ type: 'intent', intent: { kind: 'x' } })).toBeNull();
    expect(parseGuestMessage({ type: 'intent' })).toBeNull();
  });

  it('rejects anything else', () => {
    for (const raw of [null, 'hello', 42, [], { type: 'ping' }, {}]) expect(parseGuestMessage(raw)).toBeNull();
  });
});

describe('parseHostMessage', () => {
  it('parses each message type', () => {
    expect(parseHostMessage({ type: 'welcome', playerId: 'p1', token: 't' })).toEqual({ type: 'welcome', playerId: 'p1', token: 't' });
    expect(parseHostMessage({ type: 'lobby', lobby: { hostId: 'p0' } })?.type).toBe('lobby');
    expect(parseHostMessage({ type: 'view', view: { you: 0 } })?.type).toBe('view');
    expect(parseHostMessage({ type: 'error', reason: 'Room full' })).toEqual({ type: 'error', reason: 'Room full' });
  });

  it('rejects malformed messages', () => {
    for (const raw of [null, [], { type: 'welcome', playerId: 'p1' }, { type: 'lobby' }, { type: 'error' }, { type: 'nope' }]) {
      expect(parseHostMessage(raw)).toBeNull();
    }
  });
});
```

`src/net/errors.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { describePeerError } from './errors';

describe('describePeerError', () => {
  it('explains known PeerJS error types', () => {
    expect(describePeerError({ type: 'peer-unavailable' })).toBe('Room not found. Check the code and try again.');
    expect(describePeerError({ type: 'network' })).toBe('Could not reach the connection server. Check your internet connection and try again.');
    expect(describePeerError({ type: 'server-error' })).toBe('Could not reach the connection server. Check your internet connection and try again.');
    expect(describePeerError({ type: 'browser-incompatible' })).toBe('This browser does not support peer-to-peer connections.');
  });

  it('falls back to the error message', () => {
    expect(describePeerError(new Error('Timed out'))).toBe('Timed out');
    expect(describePeerError(null)).toBe('Connection failed.');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/net`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the transport and memory pair**

`src/net/transport.ts`:
```ts
/** A message channel between the host and one player. PeerJS and in-memory pairs both implement it. */
export interface Connection {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}
```

`src/net/memory.ts`:
```ts
import type { Connection } from './transport';

class MemoryEnd implements Connection {
  peer!: MemoryEnd;
  closed = false;
  private messageHandlers: ((msg: unknown) => void)[] = [];
  private closeHandlers: (() => void)[] = [];

  send(msg: unknown): void {
    if (this.closed) return;
    // A JSON round-trip mimics what crosses a real network connection.
    const copy: unknown = JSON.parse(JSON.stringify(msg));
    const target = this.peer;
    queueMicrotask(() => {
      if (!target.closed) for (const handler of target.messageHandlers) handler(copy);
    });
  }

  onMessage(cb: (msg: unknown) => void): void {
    this.messageHandlers.push(cb);
  }

  onClose(cb: () => void): void {
    this.closeHandlers.push(cb);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const handler of this.closeHandlers) handler();
    this.peer.close();
  }
}

/** Two connected ends. Used for the host's own UI and for tests. */
export function createMemoryPair(): [Connection, Connection] {
  const a = new MemoryEnd();
  const b = new MemoryEnd();
  a.peer = b;
  b.peer = a;
  return [a, b];
}

/** Resolves after every queued message (and the replies they trigger) has been delivered. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
```

- [ ] **Step 4: Implement room codes**

`src/net/roomCode.ts`:
```ts
/** No I, L, O, 0 or 1, so codes are easy to read aloud and type. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export function generateRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return code.length === CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c)) ? code : null;
}

export function peerIdFor(code: string): string {
  return `dmf-${code}`;
}

export function joinLink(base: string, code: string): string {
  return `${base}#join=${code}`;
}

export function codeFromHash(hash: string): string | null {
  const match = /^#join=(.+)$/.exec(hash);
  return match ? normalizeRoomCode(match[1]) : null;
}
```

- [ ] **Step 5: Implement the protocol**

`src/net/protocol.ts`:
```ts
import type { CardId, Intent } from '../engine/types';
import type { PlayerView } from '../engine/view';

export interface LobbyPlayer {
  id: string;
  name: string;
  online: boolean;
}

export interface LobbyState {
  hostId: string;
  players: LobbyPlayer[];
  kingdom: CardId[];
  inGame: boolean;
}

export type GuestMessage =
  | { type: 'hello'; name: string; token: string | null }
  | { type: 'intent'; intent: Intent };

export type HostMessage =
  | { type: 'welcome'; playerId: string; token: string }
  | { type: 'lobby'; lobby: LobbyState }
  | { type: 'view'; view: PlayerView }
  | { type: 'error'; reason: string };

export const MAX_NAME_LENGTH = 20;
const MAX_TOKEN_LENGTH = 64;

export function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, MAX_NAME_LENGTH) : '';
  return name || 'Player';
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Validates the envelope of a guest message. Intent contents are validated by the engine. */
export function parseGuestMessage(raw: unknown): GuestMessage | null {
  if (!isRecord(raw)) return null;
  if (raw.type === 'hello') {
    const token = typeof raw.token === 'string' && raw.token.length <= MAX_TOKEN_LENGTH ? raw.token : null;
    return { type: 'hello', name: cleanName(raw.name), token };
  }
  if (raw.type === 'intent' && isRecord(raw.intent) && typeof raw.intent.type === 'string') {
    return { type: 'intent', intent: raw.intent as unknown as Intent };
  }
  return null;
}

export function parseHostMessage(raw: unknown): HostMessage | null {
  if (!isRecord(raw)) return null;
  switch (raw.type) {
    case 'welcome':
      return typeof raw.playerId === 'string' && typeof raw.token === 'string'
        ? { type: 'welcome', playerId: raw.playerId, token: raw.token }
        : null;
    case 'lobby':
      return isRecord(raw.lobby) ? { type: 'lobby', lobby: raw.lobby as unknown as LobbyState } : null;
    case 'view':
      return isRecord(raw.view) ? { type: 'view', view: raw.view as unknown as PlayerView } : null;
    case 'error':
      return typeof raw.reason === 'string' ? { type: 'error', reason: raw.reason } : null;
    default:
      return null;
  }
}
```

- [ ] **Step 6: Implement error descriptions**

`src/net/errors.ts`:
```ts
const SERVER_UNREACHABLE = 'Could not reach the connection server. Check your internet connection and try again.';

/** Turns PeerJS and connection errors into messages a player can act on. */
export function describePeerError(err: unknown): string {
  const type = typeof err === 'object' && err !== null ? (err as { type?: unknown }).type : undefined;
  switch (type) {
    case 'peer-unavailable':
      return 'Room not found. Check the code and try again.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return SERVER_UNREACHABLE;
    case 'browser-incompatible':
      return 'This browser does not support peer-to-peer connections.';
    default:
      return err instanceof Error && err.message ? err.message : 'Connection failed.';
  }
}
```

- [ ] **Step 7: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/net
git commit -m "feat: add room codes, message protocol, memory transport and error messages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: HostSession: seats, lobby, game and broadcasting

**Files:**
- Create: `src/net/host.ts`, `src/net/testing.ts`
- Test: `src/net/host.test.ts`, `src/net/host-game.test.ts`

**Interfaces:**
- Consumes:
  - From Task 2: `Connection`, `createMemoryPair`, `flush`, `parseGuestMessage`, `HostMessage`, `LobbyState`.
  - From the engine: `Game`, `viewFor`, `KINGDOM_IDS`, `createRng`, `nextFloat`, `shuffle`.
- Produces:
```ts
const MIN_PLAYERS = 2, MAX_PLAYERS = 4
interface HostOptions { random?: () => number; makeToken?: () => string }
class HostSession {
  constructor(opts?: HostOptions)
  connectLocal(): Connection           // the host's own UI; that seat becomes the host
  accept(conn: Connection, isHost?: boolean): void
  get lobby(): LobbyState
  get game(): Game | null
  setKingdom(kingdom: CardId[]): ApplyResult
  randomizeKingdom(): void
  start(): ApplyResult
  playAgain(): ApplyResult
  backToLobby(): void
}
// testing.ts
seededHostOptions(seed?): HostOptions   // deterministic random + tokens 'token-0', 'token-1', ...
interface TestClient { conn; messages: HostMessage[]; closed: boolean; send(msg); last(type); close() }
connectClient(host, opts?: { local?: boolean }): TestClient
join(host, name, opts?: { local?: boolean; token?: string }): Promise<TestClient>   // sends hello, then flushes
```

- [ ] **Step 1: Write the test helpers**

`src/net/testing.ts`:
```ts
// Helpers for tests only. Not imported by production code.
import { createRng, nextFloat } from '../engine/rng';
import type { HostOptions, HostSession } from './host';
import { createMemoryPair, flush } from './memory';
import type { HostMessage } from './protocol';
import type { Connection } from './transport';

export function seededHostOptions(seed = 1): HostOptions {
  const rng = createRng(seed);
  let n = 0;
  return { random: () => nextFloat(rng), makeToken: () => `token-${n++}` };
}

export interface TestClient {
  conn: Connection;
  messages: HostMessage[];
  closed: boolean;
  send(msg: unknown): void;
  last<T extends HostMessage['type']>(type: T): Extract<HostMessage, { type: T }> | undefined;
  close(): void;
}

export function connectClient(host: HostSession, opts: { local?: boolean } = {}): TestClient {
  let conn: Connection;
  if (opts.local) {
    conn = host.connectLocal();
  } else {
    const [hostEnd, clientEnd] = createMemoryPair();
    host.accept(hostEnd);
    conn = clientEnd;
  }
  const client: TestClient = {
    conn,
    messages: [],
    closed: false,
    send: (msg) => conn.send(msg),
    last: (type) => [...client.messages].reverse().find((m) => m.type === type) as never,
    close: () => conn.close(),
  };
  conn.onMessage((msg) => client.messages.push(msg as HostMessage));
  conn.onClose(() => {
    client.closed = true;
  });
  return client;
}

export async function join(
  host: HostSession,
  name: string,
  opts: { local?: boolean; token?: string } = {},
): Promise<TestClient> {
  const client = connectClient(host, opts);
  client.send({ type: 'hello', name, token: opts.token ?? null });
  await flush();
  return client;
}
```

- [ ] **Step 2: Write the failing lobby tests**

`src/net/host.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { KINGDOM_IDS } from '../cards/registry';
import { HostSession } from './host';
import { flush } from './memory';
import { connectClient, join, seededHostOptions } from './testing';

describe('HostSession lobby', () => {
  it('makes the local connection the host and welcomes it', async () => {
    const host = new HostSession(seededHostOptions());
    const me = await join(host, 'Ana', { local: true });
    expect(me.last('welcome')).toEqual({ type: 'welcome', playerId: 'p0', token: 'token-0' });
    const lobby = me.last('lobby')!.lobby;
    expect(lobby).toMatchObject({ hostId: 'p0', players: [{ id: 'p0', name: 'Ana', online: true }], inGame: false });
    expect(lobby.kingdom).toHaveLength(10);
  });

  it('seats guests in order and broadcasts the lobby to everyone', async () => {
    const host = new HostSession(seededHostOptions());
    const ana = await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    expect(bo.last('welcome')).toMatchObject({ playerId: 'p1' });
    expect(ana.last('lobby')!.lobby.players.map((p) => p.name)).toEqual(['Ana', 'Bo']);
    expect(bo.last('lobby')!.lobby.players.map((p) => p.name)).toEqual(['Ana', 'Bo']);
  });

  it('cleans player names', async () => {
    const host = new HostSession(seededHostOptions());
    await join(host, 'Ana', { local: true });
    await join(host, '   ');
    await join(host, 'x'.repeat(30));
    expect(host.lobby.players.map((p) => p.name)).toEqual(['Ana', 'Player', 'x'.repeat(20)]);
  });

  it('refuses a fifth player', async () => {
    const host = new HostSession(seededHostOptions());
    await join(host, 'P0', { local: true });
    for (const name of ['P1', 'P2', 'P3']) await join(host, name);
    const late = await join(host, 'P4');
    expect(late.last('error')).toEqual({ type: 'error', reason: 'Room full' });
    expect(late.last('welcome')).toBeUndefined();
    expect(host.lobby.players).toHaveLength(4);
  });

  it('removes guests who leave the lobby', async () => {
    const host = new HostSession(seededHostOptions());
    const ana = await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    bo.close();
    await flush();
    expect(ana.last('lobby')!.lobby.players.map((p) => p.name)).toEqual(['Ana']);
  });

  it('ignores malformed messages and intents from unseated connections', async () => {
    const host = new HostSession(seededHostOptions());
    const stranger = connectClient(host);
    for (const raw of [null, 'hi', 42, { type: 'nope' }, { type: 'intent', intent: { type: 'endPhase' } }]) stranger.send(raw);
    await flush();
    expect(stranger.messages).toEqual([]);
    expect(host.lobby.players).toEqual([]);
  });

  it('validates and broadcasts kingdom changes', async () => {
    const host = new HostSession(seededHostOptions());
    const ana = await join(host, 'Ana', { local: true });
    const ten = KINGDOM_IDS.slice(0, 10);
    expect(host.setKingdom(ten.slice(0, 9))).toEqual({ ok: false, reason: 'Choose 10 different kingdom cards' });
    expect(host.setKingdom([...ten.slice(0, 9), 'copper'])).toEqual({ ok: false, reason: 'Choose 10 different kingdom cards' });
    expect(host.setKingdom([...ten.slice(0, 9), ten[0]])).toEqual({ ok: false, reason: 'Choose 10 different kingdom cards' });
    expect(host.setKingdom(ten)).toEqual({ ok: true });
    await flush();
    expect(ana.last('lobby')!.lobby.kingdom).toEqual(ten);

    host.randomizeKingdom();
    await flush();
    const randomized = ana.last('lobby')!.lobby.kingdom;
    expect(new Set(randomized).size).toBe(10);
    expect(randomized.every((id) => KINGDOM_IDS.includes(id))).toBe(true);
  });
});
```

- [ ] **Step 3: Write the failing game-flow tests**

`src/net/host-game.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { HostSession } from './host';
import { flush } from './memory';
import { join, seededHostOptions, type TestClient } from './testing';

async function lobbyOf(names: string[]): Promise<{ host: HostSession; clients: TestClient[] }> {
  const host = new HostSession(seededHostOptions());
  const clients = [await join(host, names[0], { local: true })];
  for (const name of names.slice(1)) clients.push(await join(host, name));
  return { host, clients };
}

async function started(names: string[]) {
  const ctx = await lobbyOf(names);
  expect(ctx.host.start()).toEqual({ ok: true });
  await flush();
  return ctx;
}

function turnClient(host: HostSession, clients: TestClient[]): TestClient {
  return clients[host.game!.state.turn.player];
}

describe('HostSession game flow', () => {
  it('needs two players to start', async () => {
    const { host } = await lobbyOf(['Ana']);
    expect(host.start()).toEqual({ ok: false, reason: 'Need at least 2 players' });
  });

  it('starts the game and sends each player their own view', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    const [ana, bo] = clients;
    expect(ana.last('lobby')!.lobby.inGame).toBe(true);
    expect(bo.last('lobby')!.lobby.inGame).toBe(true);
    expect(ana.last('view')!.view.you).toBe(0);
    expect(bo.last('view')!.view.you).toBe(1);
    expect(ana.last('view')!.view.hand).toEqual(host.game!.state.players[0].hand);
    expect(bo.last('view')!.view.players[0]).not.toHaveProperty('hand');
    expect(host.start()).toEqual({ ok: false, reason: 'Game already started' });
  });

  it('applies intents and broadcasts new views', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    turnClient(host, clients).send({ type: 'intent', intent: { type: 'endPhase' } });
    await flush();
    for (const c of clients) expect(c.last('view')!.view.turn.phase).toBe('buy');
  });

  it('sends refused moves back only to the sender', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    const waiting = clients[1 - host.game!.state.turn.player];
    waiting.send({ type: 'intent', intent: { type: 'endPhase' } });
    await flush();
    expect(waiting.last('error')).toEqual({ type: 'error', reason: 'It is not your turn' });
    expect(turnClient(host, clients).last('error')).toBeUndefined();
  });

  it('rejects intents before the game starts', async () => {
    const { clients } = await lobbyOf(['Ana', 'Bo']);
    clients[1].send({ type: 'intent', intent: { type: 'endPhase' } });
    await flush();
    expect(clients[1].last('error')).toEqual({ type: 'error', reason: 'No game in progress' });
  });

  it('refuses new players once the game has started', async () => {
    const { host } = await started(['Ana', 'Bo']);
    const late = await join(host, 'Late');
    expect(late.last('error')).toEqual({ type: 'error', reason: 'Game in progress' });
    expect(host.lobby.players).toHaveLength(2);
  });

  it("keeps a disconnected player's seat and lets them rejoin with their token", async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    const [ana, bo] = clients;
    const token = bo.last('welcome')!.token;
    bo.close();
    await flush();
    expect(ana.last('lobby')!.lobby.players[1]).toMatchObject({ id: 'p1', online: false });

    const back = await join(host, 'Bo', { token });
    expect(back.last('welcome')).toMatchObject({ playerId: 'p1', token });
    expect(back.last('view')!.view.you).toBe(1);
    expect(ana.last('lobby')!.lobby.players[1].online).toBe(true);
  });

  it('replaces an older connection that uses the same token', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    const bo = clients[1];
    const second = await join(host, 'Bo', { token: bo.last('welcome')!.token });
    expect(bo.closed).toBe(true);
    expect(second.last('welcome')).toMatchObject({ playerId: 'p1' });
    expect(host.lobby.players[1].online).toBe(true);
  });

  it('reports engine crashes as errors instead of throwing', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    vi.spyOn(host.game!, 'apply').mockImplementation(() => {
      throw new Error('boom');
    });
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    clients[0].send({ type: 'intent', intent: { type: 'endPhase' } });
    await flush();
    expect(clients[0].last('error')).toEqual({ type: 'error', reason: 'Something went wrong' });
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });

  it('plays again with the same kingdom only after the game ends', async () => {
    const { host, clients } = await started(['Ana', 'Bo']);
    expect(host.playAgain()).toEqual({ ok: false, reason: 'The game is not over' });
    const kingdom = host.game!.state.kingdom;
    host.game!.state.supply.province = 0;
    turnClient(host, clients).send({ type: 'intent', intent: { type: 'endPhase' } });
    await flush();
    turnClient(host, clients).send({ type: 'intent', intent: { type: 'endPhase' } });
    await flush();
    expect(clients[0].last('view')!.view.result).not.toBeNull();

    expect(host.playAgain()).toEqual({ ok: true });
    await flush();
    expect(host.game!.state.result).toBeNull();
    expect(host.game!.state.kingdom).toEqual(kingdom);
    expect(clients[1].last('view')!.view.result).toBeNull();
  });

  it('goes back to the lobby and drops offline players', async () => {
    const { host, clients } = await started(['Ana', 'Bo', 'Cy']);
    clients[2].close();
    await flush();
    host.backToLobby();
    await flush();
    const lobby = clients[0].last('lobby')!.lobby;
    expect(lobby.inGame).toBe(false);
    expect(lobby.players.map((p) => p.name)).toEqual(['Ana', 'Bo']);
    expect(host.game).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/net/host`
Expected: FAIL, cannot resolve `./host`.

- [ ] **Step 5: Implement HostSession**

`src/net/host.ts`:
```ts
import { KINGDOM_IDS } from '../cards/registry';
import { Game } from '../engine/game';
import { createRng, shuffle } from '../engine/rng';
import type { ApplyResult, CardId, Intent } from '../engine/types';
import { viewFor } from '../engine/view';
import { createMemoryPair } from './memory';
import { parseGuestMessage, type HostMessage, type LobbyState } from './protocol';
import type { Connection } from './transport';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export interface HostOptions {
  random?: () => number;
  makeToken?: () => string;
}

interface Seat {
  id: string;
  name: string;
  token: string;
  conn: Connection | null;
}

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function send(conn: Connection, msg: HostMessage): void {
  conn.send(msg);
}

/** Runs in the host's browser: owns the seats, the lobby and the game. */
export class HostSession {
  private seats: Seat[] = [];
  private hostSeatId: string | null = null;
  private nextSeat = 0;
  private kingdom: CardId[];
  private activeGame: Game | null = null;
  private readonly random: () => number;
  private readonly makeToken: () => string;

  constructor(opts: HostOptions = {}) {
    this.random = opts.random ?? Math.random;
    this.makeToken = opts.makeToken ?? randomToken;
    this.kingdom = this.pickRandomKingdom();
  }

  get game(): Game | null {
    return this.activeGame;
  }

  get lobby(): LobbyState {
    return {
      hostId: this.hostSeatId ?? '',
      players: this.seats.map((s) => ({ id: s.id, name: s.name, online: s.conn !== null })),
      kingdom: [...this.kingdom],
      inGame: this.activeGame !== null,
    };
  }

  /** Connects the host's own UI. The seat created through it is the host. */
  connectLocal(): Connection {
    const [hostEnd, uiEnd] = createMemoryPair();
    this.accept(hostEnd, true);
    return uiEnd;
  }

  accept(conn: Connection, isHost = false): void {
    let seat: Seat | null = null;
    conn.onMessage((raw) => {
      const msg = parseGuestMessage(raw);
      if (!msg) return;
      if (msg.type === 'hello') {
        if (!seat) seat = this.hello(conn, msg.name, msg.token, isHost);
        return;
      }
      if (seat) this.handleIntent(seat, conn, msg.intent);
    });
    conn.onClose(() => {
      if (seat && seat.conn === conn) this.disconnected(seat);
    });
  }

  setKingdom(kingdom: CardId[]): ApplyResult {
    if (this.activeGame) return fail('Game in progress');
    const valid =
      kingdom.length === 10 && new Set(kingdom).size === 10 && kingdom.every((id) => KINGDOM_IDS.includes(id));
    if (!valid) return fail('Choose 10 different kingdom cards');
    this.kingdom = [...kingdom];
    this.broadcastLobby();
    return ok();
  }

  randomizeKingdom(): void {
    if (this.activeGame) return;
    this.kingdom = this.pickRandomKingdom();
    this.broadcastLobby();
  }

  start(): ApplyResult {
    if (this.activeGame) return fail('Game already started');
    if (this.seats.length < MIN_PLAYERS) return fail('Need at least 2 players');
    this.activeGame = Game.create({
      players: this.seats.map((s) => ({ id: s.id, name: s.name })),
      kingdom: this.kingdom,
      seed: this.newSeed(),
    });
    this.broadcastLobby();
    this.broadcastViews();
    return ok();
  }

  playAgain(): ApplyResult {
    if (!this.activeGame?.state.result) return fail('The game is not over');
    this.activeGame = null;
    return this.start();
  }

  backToLobby(): void {
    if (!this.activeGame) return;
    this.activeGame = null;
    this.seats = this.seats.filter((s) => s.conn !== null);
    this.broadcastLobby();
  }

  private hello(conn: Connection, name: string, token: string | null, isHost: boolean): Seat | null {
    const existing = token ? this.seats.find((s) => s.token === token) : undefined;
    if (existing) {
      const previous = existing.conn;
      existing.conn = conn;
      if (previous && previous !== conn) previous.close();
      this.welcome(existing);
      this.broadcastLobby();
      this.sendView(existing);
      return existing;
    }
    if (this.activeGame) return this.reject(conn, 'Game in progress');
    if (this.seats.length >= MAX_PLAYERS) return this.reject(conn, 'Room full');

    const seat: Seat = { id: `p${this.nextSeat++}`, name, token: this.makeToken(), conn };
    this.seats.push(seat);
    if (isHost && this.hostSeatId === null) this.hostSeatId = seat.id;
    this.welcome(seat);
    this.broadcastLobby();
    return seat;
  }

  /** Tells the connection why it can't join. The guest closes the connection itself after reading this. */
  private reject(conn: Connection, reason: string): null {
    send(conn, { type: 'error', reason });
    return null;
  }

  private disconnected(seat: Seat): void {
    seat.conn = null;
    if (!this.activeGame) this.seats = this.seats.filter((s) => s !== seat);
    this.broadcastLobby();
  }

  private handleIntent(seat: Seat, conn: Connection, intent: Intent): void {
    if (!this.activeGame) {
      send(conn, { type: 'error', reason: 'No game in progress' });
      return;
    }
    let result: ApplyResult;
    try {
      result = this.activeGame.apply(seat.id, intent);
    } catch (err) {
      console.error('Engine error while applying intent', intent, err);
      result = fail('Something went wrong');
    }
    if (!result.ok) {
      send(conn, { type: 'error', reason: result.reason });
      return;
    }
    this.broadcastViews();
  }

  private welcome(seat: Seat): void {
    if (seat.conn) send(seat.conn, { type: 'welcome', playerId: seat.id, token: seat.token });
  }

  private broadcastLobby(): void {
    const lobby = this.lobby;
    for (const seat of this.seats) if (seat.conn) send(seat.conn, { type: 'lobby', lobby });
  }

  private broadcastViews(): void {
    for (const seat of this.seats) this.sendView(seat);
  }

  private sendView(seat: Seat): void {
    if (seat.conn && this.activeGame) {
      send(seat.conn, { type: 'view', view: viewFor(this.activeGame.state, seat.id) });
    }
  }

  private newSeed(): number {
    return Math.floor(this.random() * 2 ** 31);
  }

  private pickRandomKingdom(): CardId[] {
    return shuffle(createRng(this.newSeed()), KINGDOM_IDS).slice(0, 10);
  }
}
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass. Test output is clean, because the crash test silences its expected `console.error`.

- [ ] **Step 7: Commit**

```bash
git add src/net
git commit -m "feat: add HostSession with lobby, seats, rejoin and authoritative game flow" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: GuestSession and an end-to-end game over memory connections

**Files:**
- Create: `src/net/guest.ts`
- Test: `src/net/guest.test.ts`

**Interfaces:**
- Consumes: from Tasks 2–3, `Connection`, `createMemoryPair`, `flush`, `parseHostMessage`, `GuestMessage`, `LobbyState`, `HostSession`, `seededHostOptions`. From the engine, `PlayerView` and `Intent`. From `src/sim/bigMoney.ts`, `botMove(game)`.
- Produces:
```ts
type GuestStatus = 'connecting' | 'joined' | 'rejected' | 'disconnected'
interface GuestState { status; playerId: string | null; lobby: LobbyState | null; view: PlayerView | null; error: string | null }
interface TokenStore { get(): string | null; set(token: string): void }
class GuestSession {
  constructor(conn: Connection, name: string, tokens: TokenStore)   // sends hello immediately
  get current(): GuestState
  subscribe(listener: (state: GuestState) => void): () => void
  sendIntent(intent: Intent): void
  dismissError(): void
  leave(): void
}
localTokenStore(code: string): TokenStore     // localStorage key `dmf-token-<code>`
memoryTokenStore(initial?: string | null): TokenStore
```

- [ ] **Step 1: Write the failing tests**

`src/net/guest.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { botMove } from '../sim/bigMoney';
import { GuestSession, memoryTokenStore, type TokenStore } from './guest';
import { HostSession } from './host';
import { createMemoryPair, flush } from './memory';
import { seededHostOptions } from './testing';
import type { Connection } from './transport';

function remoteGuest(host: HostSession, name: string, tokens: TokenStore = memoryTokenStore()) {
  const [hostEnd, guestEnd]: [Connection, Connection] = createMemoryPair();
  host.accept(hostEnd);
  return { session: new GuestSession(guestEnd, name, tokens), hostEnd };
}

async function table(names: string[]) {
  const host = new HostSession(seededHostOptions());
  const sessions = [new GuestSession(host.connectLocal(), names[0], memoryTokenStore())];
  for (const name of names.slice(1)) sessions.push(remoteGuest(host, name).session);
  await flush();
  return { host, sessions };
}

describe('GuestSession', () => {
  it('joins, stores its token and tracks the lobby', async () => {
    const host = new HostSession(seededHostOptions());
    new GuestSession(host.connectLocal(), 'Ana', memoryTokenStore());
    const tokens = memoryTokenStore();
    const { session } = remoteGuest(host, 'Bo', tokens);
    expect(session.current.status).toBe('connecting');
    await flush();
    expect(session.current).toMatchObject({ status: 'joined', playerId: 'p1', error: null });
    expect(tokens.get()).toBe('token-1');
    expect(session.current.lobby!.players.map((p) => p.name)).toEqual(['Ana', 'Bo']);
  });

  it('notifies subscribers until they unsubscribe', async () => {
    const host = new HostSession(seededHostOptions());
    const session = new GuestSession(host.connectLocal(), 'Ana', memoryTokenStore());
    const seen: string[] = [];
    const unsubscribe = session.subscribe((s) => seen.push(s.status));
    await flush();
    expect(seen).toContain('joined');
    unsubscribe();
    const count = seen.length;
    host.randomizeKingdom();
    await flush();
    expect(seen).toHaveLength(count);
  });

  it('is rejected when a game is already in progress', async () => {
    const { host } = await table(['Ana', 'Bo']);
    host.start();
    const { session } = remoteGuest(host, 'Late');
    await flush();
    expect(session.current).toMatchObject({ status: 'rejected', error: 'Game in progress' });
  });

  it('rejoins its seat with a stored token after a disconnect', async () => {
    const host = new HostSession(seededHostOptions());
    new GuestSession(host.connectLocal(), 'Ana', memoryTokenStore());
    const tokens = memoryTokenStore();
    const first = remoteGuest(host, 'Bo', tokens).session;
    await flush();
    host.start();
    await flush();
    first.leave();
    await flush();

    const again = remoteGuest(host, 'Bo', tokens).session;
    await flush();
    expect(again.current).toMatchObject({ status: 'joined', playerId: 'p1' });
    expect(again.current.view!.you).toBe(1);
  });

  it('shows a refused move as an error and clears it on the next move', async () => {
    const { host, sessions } = await table(['Ana', 'Bo']);
    host.start();
    await flush();
    const waiting = sessions[1 - host.game!.state.turn.player];
    waiting.sendIntent({ type: 'endPhase' });
    await flush();
    expect(waiting.current.error).toBe('It is not your turn');
    waiting.dismissError();
    expect(waiting.current.error).toBeNull();
  });

  it('clears the view when the host goes back to the lobby', async () => {
    const { host, sessions } = await table(['Ana', 'Bo']);
    host.start();
    await flush();
    expect(sessions[1].current.view).not.toBeNull();
    host.backToLobby();
    await flush();
    expect(sessions[1].current.view).toBeNull();
    expect(sessions[1].current.lobby!.inGame).toBe(false);
  });

  it('reports when the host goes away', async () => {
    const host = new HostSession(seededHostOptions());
    new GuestSession(host.connectLocal(), 'Ana', memoryTokenStore());
    const { session, hostEnd } = remoteGuest(host, 'Bo');
    await flush();
    hostEnd.close();
    expect(session.current.status).toBe('disconnected');
  });

  it('plays a complete game through guest sessions', async () => {
    const { host, sessions } = await table(['Ana', 'Bo']);
    expect(host.start()).toEqual({ ok: true });
    await flush();
    const byId = new Map(sessions.map((s) => [s.current.playerId!, s]));
    const game = host.game!;
    for (let step = 0; step < 5000 && !game.state.result; step++) {
      const { playerId, intent } = botMove(game);
      const session = byId.get(playerId)!;
      session.sendIntent(intent);
      await flush();
      expect(session.current.error, `step ${step}`).toBeNull();
    }
    expect(game.state.result).not.toBeNull();
    for (const s of sessions) expect(s.current.view!.result!.winners).toEqual(game.state.result!.winners);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/net/guest.test.ts`
Expected: FAIL, cannot resolve `./guest`.

- [ ] **Step 3: Implement GuestSession**

`src/net/guest.ts`:
```ts
import type { Intent } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { parseHostMessage, type GuestMessage, type HostMessage, type LobbyState } from './protocol';
import type { Connection } from './transport';

export type GuestStatus = 'connecting' | 'joined' | 'rejected' | 'disconnected';

export interface GuestState {
  status: GuestStatus;
  playerId: string | null;
  lobby: LobbyState | null;
  view: PlayerView | null;
  /** The last error from the host: why joining failed, or why a move was refused. */
  error: string | null;
}

export interface TokenStore {
  get(): string | null;
  set(token: string): void;
}

/** One player's side of the connection, the host's own UI included. */
export class GuestSession {
  private state: GuestState = { status: 'connecting', playerId: null, lobby: null, view: null, error: null };
  private readonly listeners = new Set<(state: GuestState) => void>();

  constructor(
    private readonly conn: Connection,
    name: string,
    private readonly tokens: TokenStore,
  ) {
    conn.onMessage((raw) => {
      const msg = parseHostMessage(raw);
      if (msg) this.receive(msg);
    });
    conn.onClose(() => {
      if (this.state.status !== 'rejected') this.update({ status: 'disconnected' });
    });
    const hello: GuestMessage = { type: 'hello', name, token: tokens.get() };
    conn.send(hello);
  }

  get current(): GuestState {
    return this.state;
  }

  subscribe(listener: (state: GuestState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  sendIntent(intent: Intent): void {
    if (this.state.status !== 'joined') return;
    if (this.state.error) this.update({ error: null });
    const msg: GuestMessage = { type: 'intent', intent };
    this.conn.send(msg);
  }

  dismissError(): void {
    this.update({ error: null });
  }

  leave(): void {
    this.conn.close();
  }

  private receive(msg: HostMessage): void {
    switch (msg.type) {
      case 'welcome':
        this.tokens.set(msg.token);
        this.update({ status: 'joined', playerId: msg.playerId, error: null });
        break;
      case 'lobby':
        this.update({ lobby: msg.lobby, view: msg.lobby.inGame ? this.state.view : null });
        break;
      case 'view':
        this.update({ view: msg.view });
        break;
      case 'error':
        if (this.state.status === 'connecting') {
          this.update({ status: 'rejected', error: msg.reason });
          this.conn.close();
        } else {
          this.update({ error: msg.reason });
        }
        break;
    }
  }

  private update(patch: Partial<GuestState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
}

export function localTokenStore(code: string): TokenStore {
  const key = `dmf-token-${code}`;
  return {
    get() {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(token) {
      try {
        localStorage.setItem(key, token);
      } catch {
        // Storage unavailable (private mode): rejoining after a refresh won't work, but play continues.
      }
    },
  };
}

export function memoryTokenStore(initial: string | null = null): TokenStore {
  let token = initial;
  return {
    get: () => token,
    set: (value) => {
      token = value;
    },
  };
}
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass. The full-game test should finish in a few seconds at most. If it takes over 10s, report it rather than lowering the step cap.

- [ ] **Step 5: Commit**

```bash
git add src/net/guest.ts src/net/guest.test.ts
git commit -m "feat: add GuestSession with rejoin tokens and an end-to-end game test" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: PeerJS adapter and session wiring

**Files:**
- Create: `src/net/peer.ts`, `src/ui/connect.ts`

**Interfaces:**
- Consumes: `Connection`, `peerIdFor`, `generateRoomCode`, `HostSession`, `GuestSession`, `localTokenStore`, `memoryTokenStore`.
- Produces:
```ts
// net/peer.ts
interface HostPeer { code: string; onConnection(cb: (conn: Connection) => void): void; destroy(): void }
hostWithFreshCode(generate: () => string): Promise<HostPeer>   // retries 'unavailable-id' up to 3 times
connectToHost(code: string): Promise<Connection>             // rejects after 10s
// ui/connect.ts
interface ActiveSession { code: string; session: GuestSession; host: HostSession | null; close(): void }
hostGame(name: string): Promise<ActiveSession>
joinGame(code: string, name: string): Promise<ActiveSession>
```
These modules talk to the real PeerJS broker, so they have no unit tests. They are verified by typecheck and build here, and in the browser in Task 8.

- [ ] **Step 1: Implement the PeerJS adapter**

`src/net/peer.ts`:
```ts
import Peer, { type DataConnection } from 'peerjs';
import { peerIdFor } from './roomCode';
import type { Connection } from './transport';

const CONNECT_TIMEOUT_MS = 10_000;
const HOST_ATTEMPTS = 3;

function wrap(dc: DataConnection, onClosed?: () => void): Connection {
  return {
    send(msg) {
      if (dc.open) void dc.send(msg);
    },
    onMessage(cb) {
      dc.on('data', cb);
    },
    onClose(cb) {
      dc.on('close', cb);
      dc.on('error', cb);
    },
    close() {
      dc.close();
      onClosed?.();
    },
  };
}

export interface HostPeer {
  code: string;
  onConnection(cb: (conn: Connection) => void): void;
  destroy(): void;
}

function openHostPeer(code: string): Promise<HostPeer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerIdFor(code));
    let opened = false;
    peer.on('open', () => {
      opened = true;
      resolve({
        code,
        onConnection(cb) {
          peer.on('connection', (dc) => {
            dc.on('open', () => cb(wrap(dc)));
          });
        },
        destroy() {
          peer.destroy();
        },
      });
    });
    // Losing the broker only stops new guests from joining; existing connections keep working.
    peer.on('disconnected', () => {
      if (!peer.destroyed) peer.reconnect();
    });
    peer.on('error', (err) => {
      if (opened) {
        console.warn('Host connection error', err);
        return;
      }
      peer.destroy();
      reject(err);
    });
  });
}

/** Opens the host's peer, picking a new room code if the first one is taken. */
export async function hostWithFreshCode(generate: () => string): Promise<HostPeer> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await openHostPeer(generate());
    } catch (err) {
      const taken = (err as { type?: string } | null)?.type === 'unavailable-id';
      if (!taken || attempt >= HOST_ATTEMPTS) throw err;
    }
  }
}

export function connectToHost(code: string): Promise<Connection> {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    let settled = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      peer.destroy();
      reject(err);
    };
    const timer = setTimeout(
      () => fail(new Error('Could not connect. The code may be wrong, or your network blocks peer-to-peer connections.')),
      CONNECT_TIMEOUT_MS,
    );
    peer.on('error', fail);
    peer.on('open', () => {
      const dc = peer.connect(peerIdFor(code), { reliable: true, serialization: 'json' });
      dc.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(wrap(dc, () => peer.destroy()));
      });
    });
  });
}
```

- [ ] **Step 2: Implement session wiring**

`src/ui/connect.ts`:
```ts
import { GuestSession, localTokenStore, memoryTokenStore } from '../net/guest';
import { HostSession } from '../net/host';
import { connectToHost, hostWithFreshCode } from '../net/peer';
import { generateRoomCode } from '../net/roomCode';

export interface ActiveSession {
  code: string;
  /** This player's view of the room. The host plays through one too. */
  session: GuestSession;
  /** Present only in the host's tab. */
  host: HostSession | null;
  close(): void;
}

export async function hostGame(name: string): Promise<ActiveSession> {
  const peer = await hostWithFreshCode(() => generateRoomCode());
  const host = new HostSession();
  peer.onConnection((conn) => host.accept(conn));
  const session = new GuestSession(host.connectLocal(), name, memoryTokenStore());
  return { code: peer.code, session, host, close: () => peer.destroy() };
}

export async function joinGame(code: string, name: string): Promise<ActiveSession> {
  const conn = await connectToHost(code);
  const session = new GuestSession(conn, name, localTokenStore(code));
  return { code, session, host: null, close: () => session.leave() };
}
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass. PeerJS is bundled, and the build may warn about chunk size. That warning is acceptable; mention it in the report.

- [ ] **Step 4: Commit**

```bash
git add src/net/peer.ts src/ui/connect.ts
git commit -m "feat: add PeerJS adapter and host/join session wiring" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: UI logic helpers

**Files:**
- Create: `src/ui/moves.ts`, `src/ui/format.ts`, `src/ui/promptSelection.ts`
- Test: `src/ui/moves.test.ts`, `src/ui/format.test.ts`, `src/ui/promptSelection.test.ts`

**Interfaces:**
- Consumes: `PlayerView`, `viewFor`, `Game`, the testkit (`newState`, `setZones`) for tests, `getCard`, `isType` and `cardName`.
- Produces:
```ts
// moves.ts
isMyTurn(view): boolean
playableHand(view): boolean[]                 // per hand index
canPlayAllTreasures(view): boolean
buyablePiles(view): Set<CardId>
intentForHandCard(view, handIndex): Intent | null
sortByCost(ids: CardId[]): CardId[]           // cost, then display name
supplyGroups(view): { treasure: CardId[]; victory: CardId[]; kingdom: CardId[] }
// format.ts
formatLogEntry(entry: LogEntry, names: string[]): string
// promptSelection.ts
type Selection = number[]
toggle(prompt: Prompt, selection: Selection, index: number): Selection
cardsAnswer(prompt: Prompt, selection: Selection): PromptAnswer | null
selectionHint(prompt: Prompt): string
```

- [ ] **Step 1: Write the failing tests**

`src/ui/moves.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../engine/game';
import { newState, setZones } from '../engine/testkit';
import { viewFor } from '../engine/view';
import { buyablePiles, canPlayAllTreasures, intentForHandCard, isMyTurn, playableHand, sortByCost, supplyGroups } from './moves';

function stateWithHand(hand: string[]) {
  const state = newState();
  setZones(state, 0, { hand, deck: ['estate', 'estate', 'estate'], discard: [] });
  return state;
}

describe('moves', () => {
  it('knows whose turn it is', () => {
    const state = newState();
    expect(isMyTurn(viewFor(state, 'p0'))).toBe(true);
    expect(isMyTurn(viewFor(state, 'p1'))).toBe(false);
  });

  it('marks Actions and Treasures playable on your turn', () => {
    const state = stateWithHand(['village', 'copper', 'estate']);
    expect(playableHand(viewFor(state, 'p0'))).toEqual([true, true, false]);
    expect(canPlayAllTreasures(viewFor(state, 'p0'))).toBe(true);
  });

  it('marks nothing playable on someone else\'s turn', () => {
    const state = stateWithHand(['village', 'copper']);
    setZones(state, 1, { hand: ['village', 'copper'] });
    expect(playableHand(viewFor(state, 'p1'))).toEqual([false, false]);
    expect(canPlayAllTreasures(viewFor(state, 'p1'))).toBe(false);
  });

  it('stops Actions with no Actions left and Treasures after buying', () => {
    const state = stateWithHand(['village', 'copper']);
    state.turn.actions = 0;
    expect(playableHand(viewFor(state, 'p0'))).toEqual([false, true]);
    state.turn.boughtThisTurn = true;
    expect(playableHand(viewFor(state, 'p0'))).toEqual([false, false]);
    expect(canPlayAllTreasures(viewFor(state, 'p0'))).toBe(false);
  });

  it('marks nothing playable while a prompt is open', () => {
    const game = new Game(stateWithHand(['chapel', 'copper', 'estate']));
    game.apply('p0', { type: 'playAction', handIndex: 0 });
    const view = viewFor(game.state, 'p0');
    expect(view.prompt).not.toBeNull();
    expect(playableHand(view)).toEqual([false, false]);
    expect(buyablePiles(view).size).toBe(0);
  });

  it('lists affordable, non-empty piles while you have Buys', () => {
    const state = newState();
    state.turn.coins = 3;
    state.supply.village = 0;
    const piles = buyablePiles(viewFor(state, 'p0'));
    expect(piles.has('silver')).toBe(true);
    expect(piles.has('cellar')).toBe(true);
    expect(piles.has('village')).toBe(false);
    expect(piles.has('gold')).toBe(false);
    state.turn.buys = 0;
    expect(buyablePiles(viewFor(state, 'p0')).size).toBe(0);
  });

  it('turns a hand click into the right intent', () => {
    const view = viewFor(stateWithHand(['village', 'copper', 'estate']), 'p0');
    expect(intentForHandCard(view, 0)).toEqual({ type: 'playAction', handIndex: 0 });
    expect(intentForHandCard(view, 1)).toEqual({ type: 'playTreasure', handIndex: 1 });
    expect(intentForHandCard(view, 2)).toBeNull();
    expect(intentForHandCard(view, 9)).toBeNull();
  });

  it('orders the supply by cost, then name', () => {
    expect(sortByCost(['market', 'village', 'cellar', 'festival'])).toEqual(['cellar', 'village', 'festival', 'market']);
    const groups = supplyGroups(viewFor(newState(), 'p0'));
    expect(groups.treasure).toEqual(['copper', 'silver', 'gold']);
    expect(groups.victory).toEqual(['estate', 'duchy', 'province', 'curse']);
    expect(groups.kingdom).toHaveLength(10);
  });
});
```

`src/ui/format.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatLogEntry } from './format';

describe('formatLogEntry', () => {
  const names = ['Ana', 'Bo'];

  it('names the player and the cards', () => {
    expect(formatLogEntry({ player: 0, text: 'plays', cards: ['village', 'smithy'] }, names)).toBe('Ana plays Village, Draw Three');
  });

  it('handles entries without cards or without a player', () => {
    expect(formatLogEntry({ player: 1, text: 'puts a card onto their deck' }, names)).toBe('Bo puts a card onto their deck');
    expect(formatLogEntry({ player: null, text: 'Game over' }, names)).toBe('Game over');
  });
});
```

`src/ui/promptSelection.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Prompt } from '../engine/types';
import { cardsAnswer, selectionHint, toggle } from './promptSelection';

const choose = (selectable: number[], min: number, max: number): Prompt => ({
  kind: 'chooseCards', player: 0, message: '', cards: ['copper', 'estate', 'silver'], selectable, min, max,
});
const order: Prompt = { kind: 'orderCards', player: 0, message: '', cards: ['gold', 'silver'] };

describe('promptSelection', () => {
  it('toggles only selectable cards, up to max', () => {
    const p = choose([0, 2], 1, 2);
    expect(toggle(p, [], 1)).toEqual([]);
    expect(toggle(p, [], 0)).toEqual([0]);
    expect(toggle(p, [0], 2)).toEqual([0, 2]);
    expect(toggle(p, [0, 2], 0)).toEqual([2]);
    expect(toggle(choose([0, 1, 2], 0, 2), [0, 1], 2)).toEqual([0, 1]);
  });

  it('replaces the pick when only one card may be chosen', () => {
    expect(toggle(choose([0, 1, 2], 1, 1), [0], 2)).toEqual([2]);
  });

  it('builds a card answer only within min and max', () => {
    const p = choose([0, 1, 2], 1, 2);
    expect(cardsAnswer(p, [])).toBeNull();
    expect(cardsAnswer(p, [2, 0])).toEqual({ kind: 'cards', indices: [0, 2] });
    expect(cardsAnswer(choose([0, 1, 2], 0, 4), [])).toEqual({ kind: 'cards', indices: [] });
  });

  it('builds an order answer once every card is placed', () => {
    expect(toggle(order, [], 1)).toEqual([1]);
    expect(toggle(order, [1], 1)).toEqual([]);
    expect(toggle(order, [], 5)).toEqual([]);
    expect(cardsAnswer(order, [1])).toBeNull();
    expect(cardsAnswer(order, [1, 0])).toEqual({ kind: 'order', order: [1, 0] });
  });

  it('describes what to pick', () => {
    expect(selectionHint(choose([0], 2, 2))).toBe('Choose 2 cards.');
    expect(selectionHint(choose([0], 0, 4))).toBe('Choose up to 4 cards.');
    expect(selectionHint(choose([0], 0, 1))).toBe('Choose up to 1 card.');
    expect(selectionHint(choose([0], 1, 2))).toBe('Choose 1 to 2 cards.');
    expect(selectionHint(order)).toBe('Click the cards in order, starting with the one to put on top.');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the helpers**

`src/ui/moves.ts`:
```ts
import { getCard, isType } from '../cards/registry';
import type { CardId, Intent } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { cardName } from '../theme';

const TREASURE_PILES: CardId[] = ['copper', 'silver', 'gold'];
const VICTORY_PILES: CardId[] = ['estate', 'duchy', 'province', 'curse'];

export function isMyTurn(view: PlayerView): boolean {
  return view.result === null && view.turn.player === view.you;
}

/** My turn, and nobody is in the middle of answering a prompt. */
function canAct(view: PlayerView): boolean {
  return isMyTurn(view) && view.prompt === null && view.waitingOn === null;
}

export function playableHand(view: PlayerView): boolean[] {
  const act = canAct(view);
  const { phase, actions, boughtThisTurn } = view.turn;
  return view.hand.map((id) => {
    if (!act) return false;
    if (isType(id, 'action')) return phase === 'action' && actions > 0;
    if (isType(id, 'treasure')) return !boughtThisTurn;
    return false;
  });
}

export function canPlayAllTreasures(view: PlayerView): boolean {
  return canAct(view) && !view.turn.boughtThisTurn && view.hand.some((id) => isType(id, 'treasure'));
}

export function buyablePiles(view: PlayerView): Set<CardId> {
  const piles = new Set<CardId>();
  if (!canAct(view) || view.turn.buys < 1) return piles;
  for (const [id, count] of Object.entries(view.supply)) {
    if (count > 0 && getCard(id).cost <= view.turn.coins) piles.add(id);
  }
  return piles;
}

export function intentForHandCard(view: PlayerView, handIndex: number): Intent | null {
  const id = view.hand[handIndex];
  if (id === undefined) return null;
  if (isType(id, 'action')) return { type: 'playAction', handIndex };
  if (isType(id, 'treasure')) return { type: 'playTreasure', handIndex };
  return null;
}

export function sortByCost(ids: CardId[]): CardId[] {
  return [...ids].sort((a, b) => getCard(a).cost - getCard(b).cost || cardName(a).localeCompare(cardName(b)));
}

export function supplyGroups(view: PlayerView): { treasure: CardId[]; victory: CardId[]; kingdom: CardId[] } {
  return { treasure: TREASURE_PILES, victory: VICTORY_PILES, kingdom: sortByCost(view.kingdom) };
}
```

`src/ui/format.ts`:
```ts
import type { LogEntry } from '../engine/types';
import { cardName } from '../theme';

export function formatLogEntry(entry: LogEntry, names: string[]): string {
  const who = entry.player === null ? '' : `${names[entry.player] ?? 'Someone'} `;
  const cards = entry.cards && entry.cards.length > 0 ? ` ${entry.cards.map(cardName).join(', ')}` : '';
  return `${who}${entry.text}${cards}`;
}
```

`src/ui/promptSelection.ts`:
```ts
import type { Prompt, PromptAnswer } from '../engine/types';

/** Indices into the prompt's cards: a set for chooseCards, an ordered list for orderCards. */
export type Selection = number[];

export function toggle(prompt: Prompt, selection: Selection, index: number): Selection {
  if (prompt.kind === 'chooseCards') {
    if (!prompt.selectable.includes(index)) return selection;
    if (selection.includes(index)) return selection.filter((i) => i !== index);
    if (prompt.max === 1) return [index];
    return selection.length < prompt.max ? [...selection, index] : selection;
  }
  if (prompt.kind === 'orderCards') {
    if (!Number.isInteger(index) || index < 0 || index >= prompt.cards.length) return selection;
    return selection.includes(index) ? selection.filter((i) => i !== index) : [...selection, index];
  }
  return selection;
}

export function cardsAnswer(prompt: Prompt, selection: Selection): PromptAnswer | null {
  if (prompt.kind === 'chooseCards') {
    return selection.length >= prompt.min && selection.length <= prompt.max
      ? { kind: 'cards', indices: [...selection].sort((a, b) => a - b) }
      : null;
  }
  if (prompt.kind === 'orderCards') {
    return selection.length === prompt.cards.length ? { kind: 'order', order: [...selection] } : null;
  }
  return null;
}

export function selectionHint(prompt: Prompt): string {
  if (prompt.kind === 'orderCards') return 'Click the cards in order, starting with the one to put on top.';
  if (prompt.kind !== 'chooseCards') return '';
  const { min, max } = prompt;
  const cards = (n: number) => `${n} card${n === 1 ? '' : 's'}`;
  if (min === max) return `Choose ${cards(max)}.`;
  if (min === 0) return `Choose up to ${cards(max)}.`;
  return `Choose ${min} to ${max} cards.`;
}
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/moves.ts src/ui/moves.test.ts src/ui/format.ts src/ui/format.test.ts src/ui/promptSelection.ts src/ui/promptSelection.test.ts
git commit -m "feat: add UI helpers for playable cards, buyable piles, log lines and prompt selection" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: UI components

**Files:**
- Create: `src/ui/components/Card.tsx`, `Centered.tsx`, `Supply.tsx`, `Hand.tsx`, `Opponents.tsx`, `TurnBar.tsx`, `Log.tsx`, `PromptPanel.tsx`, `KingdomPicker.tsx` (all under `src/ui/components/`)

**Interfaces:**
- Consumes: the Task 6 helpers, `cardName`, `getCard`, `KINGDOM_IDS`, the engine types and `PlayerView`. The CSS classes come from `src/styles.css` (Task 1).
- Produces these React components, which Task 8 composes:
```ts
Card({ id, size?: 'normal' | 'small', highlight?, selected?, dimmed?, badge?: string | number, onClick? })
Centered({ children })
Supply({ view, buyable: Set<CardId>, onBuy(card) })
Hand({ cards, playable: boolean[], onPlay(handIndex) })
Opponents({ view, online(playerIndex): boolean })
TurnBar({ view, names, onPlayAll(), onEndPhase() })
Log({ entries, names })
PromptPanel({ prompt, onAnswer(answer) })
KingdomPicker({ selected: CardId[], onToggle(id), onRandomize() })
```
These are presentational and have no unit tests (the logic lives in Task 6). They are checked by typecheck and build here, and in the browser in Task 8.

- [ ] **Step 1: Card and Centered**

`src/ui/components/Card.tsx`:
```tsx
import { getCard } from '../../cards/registry';
import type { CardId } from '../../engine/types';
import { cardName } from '../../theme';

interface Props {
  id: CardId;
  size?: 'normal' | 'small';
  highlight?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  badge?: string | number;
  onClick?: () => void;
}

export function Card({ id, size = 'normal', highlight, selected, dimmed, badge, onClick }: Props) {
  const def = getCard(id);
  const primary = def.types.includes('attack') ? 'attack' : def.types.includes('reaction') ? 'reaction' : def.types[0];
  const className = [
    'card',
    `card--${primary}`,
    `card--${size}`,
    highlight && 'is-highlight',
    selected && 'is-selected',
    dimmed && 'is-dimmed',
    onClick && 'is-clickable',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={className} onClick={onClick} disabled={!onClick} title={`${cardName(id)}: ${def.text}`}>
      <span className="card__cost">{'$' + def.cost}</span>
      <span className="card__name">{cardName(id)}</span>
      {size === 'normal' && <span className="card__text">{def.text}</span>}
      <span className="card__types">{def.types.join(' · ')}</span>
      {badge !== undefined && <span className="card__badge">{badge}</span>}
    </button>
  );
}
```

`src/ui/components/Centered.tsx`:
```tsx
import type { ReactNode } from 'react';

export function Centered({ children }: { children: ReactNode }) {
  return <main className="centered">{children}</main>;
}
```

- [ ] **Step 2: Supply, Hand, Opponents**

`src/ui/components/Supply.tsx`:
```tsx
import type { CardId } from '../../engine/types';
import type { PlayerView } from '../../engine/view';
import { supplyGroups } from '../moves';
import { Card } from './Card';

interface Props {
  view: PlayerView;
  buyable: Set<CardId>;
  onBuy(card: CardId): void;
}

export function Supply({ view, buyable, onBuy }: Props) {
  const groups = supplyGroups(view);
  const pile = (id: CardId, size: 'normal' | 'small') => (
    <Card
      key={id}
      id={id}
      size={size}
      badge={view.supply[id]}
      dimmed={view.supply[id] === 0}
      highlight={buyable.has(id)}
      onClick={buyable.has(id) ? () => onBuy(id) : undefined}
    />
  );
  return (
    <div className="supply">
      <div className="supply__basics">
        {groups.treasure.map((id) => pile(id, 'small'))}
        {groups.victory.map((id) => pile(id, 'small'))}
      </div>
      <div className="supply__kingdom">{groups.kingdom.map((id) => pile(id, 'normal'))}</div>
    </div>
  );
}
```

`src/ui/components/Hand.tsx`:
```tsx
import type { CardId } from '../../engine/types';
import { Card } from './Card';

interface Props {
  cards: CardId[];
  playable: boolean[];
  onPlay(handIndex: number): void;
}

export function Hand({ cards, playable, onPlay }: Props) {
  return (
    <div className="hand">
      {cards.map((id, i) => (
        <Card key={`${i}-${id}`} id={id} highlight={playable[i]} onClick={playable[i] ? () => onPlay(i) : undefined} />
      ))}
    </div>
  );
}
```

`src/ui/components/Opponents.tsx`:
```tsx
import type { PlayerView } from '../../engine/view';
import { cardName } from '../../theme';

interface Props {
  view: PlayerView;
  online(playerIndex: number): boolean;
}

export function Opponents({ view, online }: Props) {
  return (
    <ul className="opponents">
      {view.players.map((p, i) =>
        i === view.you ? null : (
          <li key={p.id} className={i === view.turn.player ? 'is-current' : ''}>
            <span>
              <span className={`dot ${online(i) ? 'dot--on' : ''}`} />
              <strong>{p.name}</strong>
            </span>
            <span className="muted">
              Hand {p.handCount} · Deck {p.deckCount} · Discard {p.discardCount}
              {p.discardTop ? ` (${cardName(p.discardTop)})` : ''}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
```

- [ ] **Step 3: TurnBar and Log**

`src/ui/components/TurnBar.tsx`:
```tsx
import type { PlayerView } from '../../engine/view';
import { canPlayAllTreasures, isMyTurn } from '../moves';

interface Props {
  view: PlayerView;
  names: string[];
  onPlayAll(): void;
  onEndPhase(): void;
}

export function TurnBar({ view, names, onPlayAll, onEndPhase }: Props) {
  const mine = isMyTurn(view);
  const idle = mine && view.prompt === null && view.waitingOn === null;
  const t = view.turn;
  return (
    <div className="turnbar">
      <strong>{mine ? 'Your turn' : `${names[t.player]}'s turn`}</strong>
      <span className="turnbar__phase">{t.phase === 'action' ? 'Action phase' : 'Buy phase'}</span>
      <span>Actions {t.actions}</span>
      <span>Buys {t.buys}</span>
      <span>{'$' + t.coins}</span>
      {idle && (
        <>
          <button type="button" disabled={!canPlayAllTreasures(view)} onClick={onPlayAll}>
            Play all Treasures
          </button>
          <button type="button" className="primary" onClick={onEndPhase}>
            {t.phase === 'action' ? 'End Actions' : 'End turn'}
          </button>
        </>
      )}
    </div>
  );
}
```

`src/ui/components/Log.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../engine/types';
import { formatLogEntry } from '../format';

interface Props {
  entries: LogEntry[];
  names: string[];
}

export function Log({ entries, names }: Props) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);
  return (
    <ol className="log" ref={ref} aria-label="Game log">
      {entries.map((entry, i) => (
        <li key={i}>{formatLogEntry(entry, names)}</li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 4: PromptPanel and KingdomPicker**

`src/ui/components/PromptPanel.tsx`:
```tsx
import { useEffect, useState } from 'react';
import type { Prompt, PromptAnswer } from '../../engine/types';
import { cardsAnswer, selectionHint, toggle, type Selection } from '../promptSelection';
import { Card } from './Card';

interface Props {
  prompt: Prompt;
  onAnswer(answer: PromptAnswer): void;
}

export function PromptPanel({ prompt, onAnswer }: Props) {
  const [selection, setSelection] = useState<Selection>([]);
  const promptKey = JSON.stringify(prompt);
  useEffect(() => setSelection([]), [promptKey]);
  const answer = cardsAnswer(prompt, selection);
  const pick = (i: number) => setSelection((s) => toggle(prompt, s, i));
  const confirm = (
    <button type="button" className="primary" disabled={!answer} onClick={() => answer && onAnswer(answer)}>
      Confirm
    </button>
  );

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={prompt.message}>
      <div className="prompt panel">
        <h2>{prompt.message}</h2>

        {prompt.kind === 'chooseCards' && (
          <>
            <p className="muted">{selectionHint(prompt)}</p>
            <div className="card-row">
              {prompt.cards.map((id, i) => {
                const allowed = prompt.selectable.includes(i);
                return (
                  <Card
                    key={i}
                    id={id}
                    selected={selection.includes(i)}
                    dimmed={!allowed}
                    onClick={allowed ? () => pick(i) : undefined}
                  />
                );
              })}
            </div>
            <div className="actions">{confirm}</div>
          </>
        )}

        {prompt.kind === 'orderCards' && (
          <>
            <p className="muted">{selectionHint(prompt)}</p>
            <div className="card-row">
              {prompt.cards.map((id, i) => (
                <Card
                  key={i}
                  id={id}
                  selected={selection.includes(i)}
                  badge={selection.includes(i) ? selection.indexOf(i) + 1 : undefined}
                  onClick={() => pick(i)}
                />
              ))}
            </div>
            <div className="actions">
              <button type="button" onClick={() => setSelection([])}>
                Reset
              </button>
              {confirm}
            </div>
          </>
        )}

        {prompt.kind === 'chooseSupply' && (
          <>
            <div className="card-row">
              {prompt.piles.map((id) => (
                <Card key={id} id={id} onClick={() => onAnswer({ kind: 'supply', card: id })} />
              ))}
            </div>
            {prompt.optional && (
              <div className="actions">
                <button type="button" onClick={() => onAnswer({ kind: 'supply', card: null })}>
                  Skip
                </button>
              </div>
            )}
          </>
        )}

        {prompt.kind === 'chooseOption' && (
          <>
            {prompt.cards && (
              <div className="card-row">
                {prompt.cards.map((id, i) => (
                  <Card key={i} id={id} />
                ))}
              </div>
            )}
            <div className="actions">
              {prompt.options.map((label, i) => (
                <button key={i} type="button" className={i === 0 ? 'primary' : ''} onClick={() => onAnswer({ kind: 'option', index: i })}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

`src/ui/components/KingdomPicker.tsx`:
```tsx
import { KINGDOM_IDS } from '../../cards/registry';
import type { CardId } from '../../engine/types';
import { sortByCost } from '../moves';
import { Card } from './Card';

interface Props {
  selected: CardId[];
  onToggle(id: CardId): void;
  onRandomize(): void;
}

export function KingdomPicker({ selected, onToggle, onRandomize }: Props) {
  const full = selected.length >= 10;
  return (
    <div className="picker">
      <div className="picker__bar">
        <span>{selected.length}/10 chosen</span>
        <button type="button" onClick={onRandomize}>
          Randomize
        </button>
      </div>
      <div className="card-grid">
        {sortByCost(KINGDOM_IDS).map((id) => {
          const isSelected = selected.includes(id);
          return (
            <Card
              key={id}
              id={id}
              selected={isSelected}
              dimmed={!isSelected && full}
              onClick={isSelected || !full ? () => onToggle(id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass. The components are not rendered yet; Task 8 wires them in.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components
git commit -m "feat: add card, supply, hand, turn bar, log, prompt and kingdom picker components" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Screens, app routing and a two-tab browser check

**Files:**
- Create: `src/ui/storage.ts`, `src/ui/useGuestState.ts`, `src/ui/screens/Home.tsx`, `src/ui/screens/Lobby.tsx`, `src/ui/screens/Board.tsx`, `src/ui/screens/EndScreen.tsx`
- Modify: `src/ui/App.tsx` (replace the placeholder entirely)

**Interfaces:**
- Consumes: `hostGame`, `joinGame`, `ActiveSession` (Task 5); `GuestSession`, `GuestState` (Task 4); `HostSession` (Task 3); the components (Task 7); the helpers (Task 6); `describePeerError`, `codeFromHash`, `joinLink`, `normalizeRoomCode` (Task 2).
- Produces: the complete, playable app.

- [ ] **Step 1: Storage and the state hook**

`src/ui/storage.ts`:
```ts
const NAME_KEY = 'dmf-name';

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage unavailable: the name just won't be prefilled next time.
  }
}
```

`src/ui/useGuestState.ts`:
```ts
import { useCallback, useSyncExternalStore } from 'react';
import type { GuestSession, GuestState } from '../net/guest';

export function useGuestState(session: GuestSession | null): GuestState | null {
  const subscribe = useCallback((onChange: () => void) => (session ? session.subscribe(onChange) : () => {}), [session]);
  return useSyncExternalStore(subscribe, () => session?.current ?? null);
}
```

- [ ] **Step 2: Home screen**

`src/ui/screens/Home.tsx`:
```tsx
import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../../net/protocol';
import { CODE_LENGTH, normalizeRoomCode } from '../../net/roomCode';

interface Props {
  initialName: string;
  initialCode: string;
  busy: boolean;
  error: string | null;
  onHost(name: string): void;
  onJoin(code: string, name: string): void;
}

export function Home({ initialName, initialCode, busy, error, onHost, onJoin }: Props) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
  const cleanCode = normalizeRoomCode(code);
  return (
    <main className="screen home">
      <div>
        <h1>Dominion Friends</h1>
        <p className="muted">A deck-building card game for 2–4 friends.</p>
      </div>
      <label className="field">
        Your name
        <input value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} placeholder="Player" />
      </label>
      <div className="home__choices">
        <section className="panel">
          <h2>Host a game</h2>
          <p className="muted">Create a room and share the link with your friends.</p>
          <button type="button" className="primary" disabled={busy} onClick={() => onHost(name)}>
            Host game
          </button>
        </section>
        <section className="panel">
          <h2>Join a game</h2>
          <label className="field">
            Room code
            <input
              value={code}
              maxLength={CODE_LENGTH}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
              autoCapitalize="characters"
            />
          </label>
          <button type="button" className="primary" disabled={busy || !cleanCode} onClick={() => cleanCode && onJoin(cleanCode, name)}>
            Join
          </button>
        </section>
      </div>
      {busy && <p className="muted">Connecting…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Lobby screen**

`src/ui/screens/Lobby.tsx`:
```tsx
import { useEffect, useState } from 'react';
import type { CardId } from '../../engine/types';
import type { HostSession } from '../../net/host';
import type { LobbyState } from '../../net/protocol';
import { Card } from '../components/Card';
import { KingdomPicker } from '../components/KingdomPicker';
import { sortByCost } from '../moves';

interface Props {
  lobby: LobbyState;
  me: string;
  code: string;
  shareLink: string;
  host: HostSession | null;
  onLeave(): void;
}

export function Lobby({ lobby, me, code, shareLink, host, onLeave }: Props) {
  const [draft, setDraft] = useState<CardId[]>(lobby.kingdom);
  const [startError, setStartError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const kingdomKey = lobby.kingdom.join(',');
  useEffect(() => setDraft(lobby.kingdom), [kingdomKey]);

  function toggle(id: CardId) {
    const next = draft.includes(id) ? draft.filter((c) => c !== id) : draft.length < 10 ? [...draft, id] : draft;
    setDraft(next);
    if (next.length === 10) host?.setKingdom(next);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the link stays visible in the field to copy by hand.
    }
  }

  function start() {
    if (!host) return;
    const result = host.start();
    setStartError(result.ok ? null : result.reason);
  }

  const enoughPlayers = lobby.players.length >= 2;
  return (
    <main className="screen lobby">
      <header className="lobby__header">
        <h1>Room {code}</h1>
        <button type="button" onClick={onLeave}>
          Leave
        </button>
      </header>

      <section className="panel">
        <h2>Invite friends</h2>
        <div className="share">
          <input readOnly value={shareLink} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
          <button type="button" onClick={copy}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Players ({lobby.players.length}/4)</h2>
        <ul className="seats">
          {lobby.players.map((p) => (
            <li key={p.id}>
              <span className={`dot ${p.online ? 'dot--on' : ''}`} />
              {p.name}
              {p.id === lobby.hostId && ' (host)'}
              {p.id === me && ' (you)'}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Kingdom</h2>
        {host ? (
          <KingdomPicker selected={draft} onToggle={toggle} onRandomize={() => host.randomizeKingdom()} />
        ) : (
          <div className="card-row">
            {sortByCost(lobby.kingdom).map((id) => (
              <Card key={id} id={id} />
            ))}
          </div>
        )}
      </section>

      {host ? (
        <div className="actions">
          <button type="button" className="primary" disabled={!enoughPlayers || draft.length !== 10} onClick={start}>
            Start game
          </button>
          {!enoughPlayers && <span className="muted">Waiting for at least one more player…</span>}
          {draft.length !== 10 && <span className="muted">Choose 10 kingdom cards.</span>}
          {startError && <p className="error">{startError}</p>}
        </div>
      ) : (
        <p className="muted">Waiting for the host to start…</p>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Board screen**

`src/ui/screens/Board.tsx`:
```tsx
import { useState } from 'react';
import type { Intent } from '../../engine/types';
import type { PlayerView } from '../../engine/view';
import type { LobbyState } from '../../net/protocol';
import { cardName } from '../../theme';
import { Card } from '../components/Card';
import { Hand } from '../components/Hand';
import { Log } from '../components/Log';
import { Opponents } from '../components/Opponents';
import { PromptPanel } from '../components/PromptPanel';
import { Supply } from '../components/Supply';
import { TurnBar } from '../components/TurnBar';
import { buyablePiles, intentForHandCard, isMyTurn, playableHand } from '../moves';

type Tab = 'hand' | 'supply' | 'log';
const TABS: { id: Tab; label: string }[] = [
  { id: 'hand', label: 'Hand' },
  { id: 'supply', label: 'Supply' },
  { id: 'log', label: 'Log' },
];

interface Props {
  view: PlayerView;
  lobby: LobbyState;
  error: string | null;
  onIntent(intent: Intent): void;
  onDismissError(): void;
}

export function Board({ view, lobby, error, onIntent, onDismissError }: Props) {
  const [tab, setTab] = useState<Tab>('hand');
  const names = view.players.map((p) => p.name);
  const online = (i: number) => lobby.players.find((p) => p.id === view.players[i].id)?.online ?? false;
  const current = view.players[view.turn.player];
  const me = view.players[view.you];

  return (
    <main className={`board board--tab-${tab}`}>
      <nav className="board__tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <section className="board__supply">
        <Supply view={view} buyable={buyablePiles(view)} onBuy={(card) => onIntent({ type: 'buy', card })} />
      </section>

      <section className="board__opponents">
        <Opponents view={view} online={online} />
      </section>

      <section className="board__play">
        <h3>{isMyTurn(view) ? 'Your play area' : `${current.name}'s play area`}</h3>
        <div className="card-row">
          {current.inPlay.map((id, i) => (
            <Card key={i} id={id} size="small" />
          ))}
        </div>
      </section>

      <section className="board__log">
        <Log entries={view.log} names={names} />
      </section>

      <section className="board__turn">
        <TurnBar
          view={view}
          names={names}
          onPlayAll={() => onIntent({ type: 'playAllTreasures' })}
          onEndPhase={() => onIntent({ type: 'endPhase' })}
        />
        {view.waitingOn && (
          <div className="banner">
            Waiting for {names[view.waitingOn.player]}
            {online(view.waitingOn.player) ? '' : ' (offline)'}: {view.waitingOn.message}
          </div>
        )}
        {!view.waitingOn && !isMyTurn(view) && !online(view.turn.player) && (
          <div className="banner">Waiting for {current.name} (offline)…</div>
        )}
        {error && (
          <div className="toast" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onDismissError} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
      </section>

      <section className="board__hand">
        <Hand
          cards={view.hand}
          playable={playableHand(view)}
          onPlay={(i) => {
            const intent = intentForHandCard(view, i);
            if (intent) onIntent(intent);
          }}
        />
        <div className="piles muted">
          Deck {me.deckCount} · Discard {me.discardCount}
          {me.discardTop && ` (top: ${cardName(me.discardTop)})`}
        </div>
      </section>

      {view.prompt && <PromptPanel prompt={view.prompt} onAnswer={(answer) => onIntent({ type: 'answerPrompt', answer })} />}
    </main>
  );
}
```

- [ ] **Step 5: End screen**

`src/ui/screens/EndScreen.tsx`:
```tsx
import type { GameResult } from '../../engine/types';
import { cardName } from '../../theme';

interface Props {
  result: GameResult;
  isHost: boolean;
  onPlayAgain(): void;
  onBackToLobby(): void;
  onLeave(): void;
}

export function EndScreen({ result, isHost, onPlayAgain, onBackToLobby, onLeave }: Props) {
  const ranked = [...result.scores].sort((a, b) => b.vp - a.vp || a.turns - b.turns);
  const winnerNames = result.scores.filter((s) => result.winners.includes(s.playerId)).map((s) => s.name);
  return (
    <main className="screen end">
      <h1>{winnerNames.length > 1 ? `Shared victory: ${winnerNames.join(' & ')}` : `${winnerNames[0]} wins!`}</h1>
      <div className="table-wrap">
        <table className="scores">
          <thead>
            <tr>
              <th>Player</th>
              <th>VP</th>
              <th>Turns</th>
              <th>Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((s) => (
              <tr key={s.playerId} className={result.winners.includes(s.playerId) ? 'is-winner' : ''}>
                <td>{s.name}</td>
                <td>{s.vp}</td>
                <td>{s.turns}</td>
                <td>
                  {Object.entries(s.breakdown)
                    .map(([id, row]) => `${cardName(id)} ×${row.count} (${row.vp})`)
                    .join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        {isHost ? (
          <>
            <button type="button" className="primary" onClick={onPlayAgain}>
              Play again (same kingdom)
            </button>
            <button type="button" onClick={onBackToLobby}>
              Back to lobby
            </button>
          </>
        ) : (
          <span className="muted">Waiting for the host…</span>
        )}
        <button type="button" onClick={onLeave}>
          Leave
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: App routing**

Replace `src/ui/App.tsx` with:
```tsx
import { useEffect, useState } from 'react';
import { describePeerError } from '../net/errors';
import { codeFromHash, joinLink } from '../net/roomCode';
import { Centered } from './components/Centered';
import { hostGame, joinGame, type ActiveSession } from './connect';
import { Board } from './screens/Board';
import { EndScreen } from './screens/EndScreen';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { loadName, saveName } from './storage';
import { useGuestState } from './useGuestState';

export function App() {
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = useGuestState(active?.session ?? null);

  // A refused join (room full, game in progress) sends the player back to the home screen.
  useEffect(() => {
    if (state?.status !== 'rejected') return;
    setError(state.error);
    active?.close();
    setActive(null);
  }, [state?.status]);

  // Closing the host's tab ends the game for everyone, so ask first.
  useEffect(() => {
    if (!active?.host) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);

  async function connect(name: string, open: () => Promise<ActiveSession>) {
    saveName(name);
    setBusy(true);
    setError(null);
    try {
      setActive(await open());
    } catch (err) {
      setError(describePeerError(err));
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    active?.close();
    setActive(null);
    history.replaceState(null, '', location.pathname);
  }

  if (!active || !state || state.status === 'rejected') {
    return (
      <Home
        initialName={loadName()}
        initialCode={codeFromHash(location.hash) ?? ''}
        busy={busy}
        error={state?.status === 'rejected' ? state.error : error}
        onHost={(name) => connect(name, () => hostGame(name))}
        onJoin={(code, name) =>
          connect(name, async () => {
            const session = await joinGame(code, name);
            history.replaceState(null, '', `#join=${code}`);
            return session;
          })
        }
      />
    );
  }

  if (state.status === 'disconnected') {
    return (
      <Centered>
        <h1>Host disconnected</h1>
        <p className="muted">The game is over because the host left.</p>
        <button type="button" onClick={leave}>
          Back to start
        </button>
      </Centered>
    );
  }

  if (state.status === 'connecting' || !state.lobby || !state.playerId) {
    return (
      <Centered>
        <p className="muted">Joining room {active.code}…</p>
      </Centered>
    );
  }

  if (!state.lobby.inGame) {
    return (
      <Lobby
        lobby={state.lobby}
        me={state.playerId}
        code={active.code}
        shareLink={joinLink(location.origin + location.pathname, active.code)}
        host={active.host}
        onLeave={leave}
      />
    );
  }

  if (!state.view) {
    return (
      <Centered>
        <p className="muted">Starting the game…</p>
      </Centered>
    );
  }

  if (state.view.result) {
    return (
      <EndScreen
        result={state.view.result}
        isHost={active.host !== null}
        onPlayAgain={() => active.host?.playAgain()}
        onBackToLobby={() => active.host?.backToLobby()}
        onLeave={leave}
      />
    );
  }

  return (
    <Board
      view={state.view}
      lobby={state.lobby}
      error={state.error}
      onIntent={(intent) => active.session.sendIntent(intent)}
      onDismissError={() => active.session.dismissError()}
    />
  );
}
```

- [ ] **Step 7: Verify automated checks**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 8: Browser check with two tabs**

This needs internet access, because PeerJS uses the public broker for signaling. Start the dev server: `npm run dev -- --port 5173`, or the `dev` entry in `.claude/launch.json` through the preview tools. Then check each of the following and record the result in the report.

1. **Tab A, hosting:** open `http://localhost:5173`, enter "Ana" and click **Host game**. The Lobby appears with a 4-letter room code, the share link, Ana marked (host) (you), and the kingdom picker showing 10 of 10 chosen.
2. **Tab B, joining:** open the share link. The code is prefilled. Enter "Bo" and click **Join**. Both tabs list Ana and Bo with green dots, and Tab B shows the kingdom read-only.
3. **Kingdom changes:** in Tab A, click **Randomize**. Tab B's kingdom updates. Deselect one card: Start is disabled and the message says to choose 10. Select another card and Start is enabled again.
4. **Starting:** click **Start game**. Both tabs show the Board, and the turn bar names the same current player in both. The other tab never sees the current player's hand, only counts.
5. **A turn:** on the current player's tab, click **Play all Treasures**, buy a highlighted pile, then click **End turn**. The other tab's log and counts update, and it becomes that player's turn.
6. **Refused move:** this is hard to trigger from the UI. Optionally, in the console of the waiting tab, check that nothing is clickable.
7. **A prompt:** keep playing until a kingdom card that prompts is played (for example Militia or Chapel). Its prompt dialog opens only in the right tab, and the other tab shows a "Waiting for …" banner.
8. **Rejoining:** refresh Tab B mid-game. Click **Join** with the same prefilled code and name. Bo is back in seat p1 with the same hand.
9. **Narrow screens:** resize to 375px wide (the `mobile` preset). The Hand, Supply and Log tabs appear, the hand scrolls horizontally, and the page never scrolls horizontally.
10. **Host leaving:** close Tab A, the host. Tab B shows "Host disconnected".

If any check fails, fix it within this task's files (or Task 7's components), re-run Step 7, and repeat the check.

- [ ] **Step 9: Commit**

```bash
git add src/ui
git commit -m "feat: add home, lobby, board and end screens with app routing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: GitHub Pages deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: the `npm test` and `npm run build` scripts; `vite.config.ts` already sets `base: './'`.
- Produces: an Actions workflow that deploys `dist/` to GitHub Pages on every push to `main`.

- [ ] **Step 1: Write the workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify the build works from a sub-path**

Run: `npm run build && npx vite preview --port 4173 --base /dominion-friends/`
Expected: `http://localhost:4173/dominion-friends/` loads the Home screen with styles and no 404s for assets. Stop the preview afterwards.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy to GitHub Pages on push to main" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Going live requires creating a GitHub repository, pushing `main`, and setting **Settings → Pages → Source** to **GitHub Actions**. That is the user's call and is not part of this task.

---

## Spec coverage (self-review)

| Spec section | Task |
|---|---|
| §6.1 Rooms: host peer `dmf-<code>`, 4-character unambiguous code, share link `#join=` | 2, 5 |
| §6.2 Protocol: hello, intent, welcome, lobby, view, error; validation; full view after every change; host uses the same path | 2, 3, 4 |
| §6.3 Seats and rejoin: tokens in localStorage, reclaim, replace duplicates, refuse mid-game, offline seats, waiting banner, host leaving | 3, 4, 8 |
| §6.4 Errors: broker unreachable, room not found, network blocked, room full | 2, 3, 5, 8 |
| §7.1 Screens: Home, Lobby with picker, Board with prompt panel, End screen with play again / back to lobby | 7, 8 |
| §7.2 Card frames and theming via `theme/` | 1, 7 |
| §7.3 Responsive layout below 768px | 1, 8 |
| §8 Network tests over an in-memory transport; manual WebRTC check | 3, 4, 8 |
| Deploy as a static site on GitHub Pages | 9 |

Deviations from the spec are listed under Global Constraints.
