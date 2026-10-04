# Design Handover — Dominion Friends (for Claude Design)

Last updated: 2026-10-04 · Live: https://trakinos.github.io/dominion-friends/ · Screenshots: `docs/design/screens/`

## 1. What this is
**Dominion Friends** is a browser card game that 2–4 friends play together online, each on their own device. One player hosts from their browser tab and the others join with a 4-letter room code or a share link. Games last about 20–40 minutes.

The rules are Dominion's (a deck-building game). Everyone starts with a small deck. Each turn you draw 5 cards, play Action cards for effects, play Treasure cards for coins, and buy one new card from a shared Supply into your deck. Victory cards are worth points at the end. The game ends when the Provinces run out, or when any 3 Supply piles are empty.

**The game works, but it has no visual identity yet.** Today it's a clean placeholder UI: system font, flat colored rectangles for cards and no art. The plan is to give it its own theme, the way *Tanto Cuore* re-themed Dominion as a maid café. **The theme isn't decided yet, and choosing it is part of this brief.**

- **Audience:** friends playing casually, often Brazilian (Portuguese is the default language), on laptops and phones.
- **Tone:** friendly, readable, playful but not childish. Clarity of game state comes first.

## 2. What we need from design
1. **Theme concepts:** 2–3 directions, each with name ideas for the cards, a mood, a palette and a typography pairing. Any theme must map onto the existing card roles (see §6). Card names may change; card mechanics may not.
2. **Visual system:**
   - color tokens for light and dark mode (see §4 for the token names to keep or extend);
   - a type scale;
   - spacing and radius;
   - elevation;
   - focus and selection states.
3. **Card frame design.** This is the most important piece. It's a frame for every card type, at the sizes in §5, with all states. Each frame needs an **art slot** that also looks good with no art, and treatments for cost, count badge, name, rule text and type line.
4. **Screen layouts** for every screen in §7, desktop and phone (375px wide).
5. **Card art direction** for the 33 cards in §6: style, framing, aspect ratio and a naming convention. Final art can come later.
6. **Small iconography:** coin/cost ($), victory points (VP/PV), cards in hand / deck / discard, online/offline, and a language toggle.
7. **Motion guidelines** for the planned animations: cards moving between zones (draw, play, buy, discard, trash), shuffle, turn change and a prompt appearing. Respect `prefers-reduced-motion`.

## 3. Hard constraints (from the code)
- **Delivered as CSS.** Styling is one hand-written stylesheet, `src/styles.css` (about 240 lines, no CSS framework), using CSS custom properties on `:root` with a `prefers-color-scheme: dark` override. Deliver tokens as CSS variables and component styles as CSS that can drop into this file. React components only apply class names (see §8).
- **Fonts:** Google Fonts are fine. No other external assets at runtime; any art is bundled into the site.
- **Two languages, and Portuguese is longer.** Every string exists in pt-BR and English. Card names can be long ("Comerciante", "Saqueadores", "Laboratório", "Propriedade"), and rule text can reach ~180 characters (Clerk/Escrivão, Thief/Ladrão). Frames must handle long names without ugly hyphenation; see the current issues in §9.
- **Responsive:** desktop-first. Below 768px the board becomes one column with Hand / Supply / Log tabs, the hand scrolls sideways, and the page must never scroll sideways.
- **Light and dark:** both are required. The current UI follows the OS setting.
- **Accessibility:** cards are real `<button>`s. Selection and playability must not rely on color alone; today they use a border. Text needs AA contrast on card backgrounds in both modes.
- **Card types drive color:** a card can have two types (Action · Attack, Action · Reaction). The frame color comes from the most specific type, in this order: attack, then reaction, then the first listed type.

## 4. Current tokens (`src/styles.css`)
| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | #f5f2ea | #16140f | page |
| `--surface` | #ffffff | #211e17 | panels, inputs, buttons |
| `--surface-2` | #ece7da | #2b271e | banners, toasts |
| `--text` | #1f1c15 | #efe9da | text |
| `--muted` | #6d6758 | #a59d89 | secondary text, card cost and type line |
| `--border` | #d8d1bf | #3a3428 | borders |
| `--accent` | #2b62c9 | #6c9cf0 | primary buttons, playable/selected card border, active tab |
| `--accent-text` | #ffffff | #0d1220 | text on accent |
| `--danger` | #b3261e | #ff8a80 | errors |
| `--online` | #2e8b57 | #5cc98a | online dot |
| `--t-action` | #e9e3d1 | #4a4535 | Action card background |
| `--t-treasure` | #f2d36b | #7a6420 | Treasure |
| `--t-victory` | #a6d68f | #3f6a33 | Victory |
| `--t-curse` | #b996dc | #57407a | Curse |
| `--t-attack` | #eaa48f | #7a3f30 | Attack |
| `--t-reaction` | #92c4ea | #2f5a7a | Reaction |
| `--radius` | 10px | | panels |

Font: `15px/1.4 system-ui`. Cards have an 8px radius and a 2px border.

## 5. Card frame: anatomy, sizes and states
**Content today, from top to bottom:** cost (`$4`), name (bold), rule text (normal size only), type line (`AÇÃO · ATAQUE`, small caps), and a count badge in the bottom-right corner (Supply piles only, e.g. how many are left).

| Size | Desktop | Phone | Where |
|---|---|---|---|
| normal | 112px wide, min 150px tall | 96 × 132 | kingdom Supply, hand, lobby picker, prompts |
| small | 84px wide, no rule text | 76px | basic Supply piles (Treasure/Victory/Curse), play area |

**States (each needs a design):**
- default
- **playable / buyable** (`is-highlight`): your turn and the card can be clicked
- **selected** (`is-selected`): picked in a prompt or in the lobby kingdom picker; it lifts 4px
- **dimmed** (`is-dimmed`): an empty pile, or not choosable in a prompt
- **clickable** (`is-clickable`) vs **inert**, with cursor and hover
- **order badge:** in "put these back in order" prompts, a number badge 1, 2, … shows the chosen order

Planned additions: an art slot, plus a "revealed / set aside" presentation for cards shown during an effect.

## 6. The 33 cards
These are the current placeholder names, which a theme may rename. The rule text is shown in Portuguese, the default language. Each row gives the card ID, English name, Portuguese name, types, cost and Portuguese rule text.

**Basic cards (in every game):**

| id | EN name | PT name | Types | Cost | PT text |
|---|---|---|---|---|---|
| `copper` | Copper | Cobre | Treasure | 0 | $1 |
| `silver` | Silver | Prata | Treasure | 3 | $2 |
| `gold` | Gold | Ouro | Treasure | 6 | $3 |
| `estate` | Estate | Propriedade | Victory | 2 | 1 PV |
| `duchy` | Duchy | Ducado | Victory | 5 | 3 PV |
| `province` | Province | Província | Victory | 8 | 6 PV |
| `curse` | Curse | Maldição | Curse | 0 | -1 PV |

**Kingdom cards (10 of these 26 are chosen per game):**

| id | EN name | PT name | Types | Cost | PT text |
|---|---|---|---|---|---|
| `cellar` | Sift | Peneira | Action | 2 | +1 Ação. Descarte quantas cartas quiser e depois compre o mesmo número. |
| `chapel` | Purge | Expurgo | Action | 2 | Coloque até 4 cartas da sua mão no lixo. |
| `moat` | Shield | Escudo | Action · Reaction | 2 | +2 Cartas. Quando outro jogador jogar um Ataque, você pode revelar esta carta da sua mão para não ser afetado. |
| `harbinger` | Recall | Resgate | Action | 3 | +1 Carta, +1 Ação. Olhe sua pilha de descarte. Você pode colocar uma carta dela no topo do seu baralho. |
| `merchant` | Trader | Comerciante | Action | 3 | +1 Carta, +1 Ação. Na primeira vez que você jogar uma Prata neste turno, +$1. |
| `vassal` | Servant | Servo | Action | 3 | +$2. Descarte a carta do topo do seu baralho. Se for uma carta de Ação, você pode jogá-la. |
| `village` | Village | Vila | Action | 3 | +1 Carta, +2 Ações. |
| `workshop` | Workshop | Oficina | Action | 3 | Ganhe uma carta que custe até $4. |
| `bureaucrat` | Clerk | Escrivão | Action · Attack | 4 | Ganhe uma Prata no topo do seu baralho. Cada outro jogador revela uma carta de Vitória da mão e a coloca no topo do baralho (ou revela uma mão sem cartas de Vitória). |
| `gardens` | Garden | Jardim | Victory | 4 | Vale 1 PV para cada 10 cartas que você tiver (arredondado para baixo). |
| `militia` | Raiders | Saqueadores | Action · Attack | 4 | +$2. Cada outro jogador descarta até ficar com 3 cartas na mão. |
| `moneylender` | Lender | Agiota | Action | 4 | Você pode colocar um Cobre da sua mão no lixo para receber +$3. |
| `poacher` | Scavenger | Catador | Action | 4 | +1 Carta, +1 Ação, +$1. Descarte uma carta para cada pilha vazia do Suprimento. |
| `remodel` | Rebuild | Reconstruir | Action | 4 | Coloque uma carta da sua mão no lixo. Ganhe uma carta que custe até $2 a mais que ela. |
| `smithy` | Draw Three | Compre Três | Action | 4 | +3 Cartas. |
| `throne_room` | Echo | Eco | Action | 4 | Você pode jogar duas vezes uma carta de Ação da sua mão. |
| `bandit` | Thief | Ladrão | Action · Attack | 5 | Ganhe um Ouro. Cada outro jogador revela as 2 cartas do topo do baralho, coloca no lixo um Tesouro revelado que não seja Cobre e descarta o resto. |
| `council_room` | Council | Conselho | Action | 5 | +4 Cartas, +1 Compra. Cada outro jogador compra uma carta. |
| `festival` | Festival | Festival | Action | 5 | +2 Ações, +1 Compra, +$2. |
| `laboratory` | Lab | Laboratório | Action | 5 | +2 Cartas, +1 Ação. |
| `library` | Archive | Arquivo | Action | 5 | Compre até ter 7 cartas na mão, podendo separar cartas de Ação compradas; descarte as separadas no final. |
| `market` | Market | Mercado | Action | 5 | +1 Carta, +1 Ação, +1 Compra, +$1. |
| `mine` | Refinery | Refinaria | Action | 5 | Você pode colocar um Tesouro da sua mão no lixo. Ganhe na mão um Tesouro que custe até $3 a mais que ele. |
| `sentry` | Sentry | Sentinela | Action | 5 | +1 Carta, +1 Ação. Olhe as 2 cartas do topo do seu baralho. Coloque no lixo e/ou descarte quantas quiser. Devolva o resto ao topo em qualquer ordem. |
| `witch` | Hex | Feitiço | Action · Attack | 5 | +2 Cartas. Cada outro jogador ganha uma Maldição. |
| `artisan` | Artisan | Artesão | Action | 6 | Ganhe na mão uma carta que custe até $5. Coloque uma carta da sua mão no topo do seu baralho. |

**Roles a theme must express:**
- **Money:** Copper, Silver and Gold, worth 1/2/3 coins.
- **Points:** Estate, Duchy and Province, worth 1/3/6; Garden scales with deck size.
- **A penalty:** Curse.
- **Engine pieces:** extra actions, like Village and Festival.
- **Card draw:** for example Draw Three and Lab.
- **Deck thinning:** trashing cards out of your deck, like Purge and Rebuild.
- **Attacks on other players:** Raiders, Hex, Thief and Clerk.
- **A defense:** Shield.

## 7. Screens (see `docs/design/screens/`)
1. **Home** (`01`):
   - title and tagline;
   - a name field;
   - two panels: *Host a game* (button) and *Join a game* (4-letter code field and button).
   Errors appear below them, such as "Room not found".
2. **Lobby:** Room `CODE` with a Leave button, and *Invite friends* with the share link and a Copy button. It also has:
   - **Players** (n/4), with an online dot and (host) / (you) tags;
   - **Kingdom** with the 10 chosen cards: the host sees a picker of all 26 cards with Randomize and an "n/10 chosen" count (`02`, `03`), while guests see the 10 read-only;
   - **Start game** (host only), or "Waiting for the host" for guests.
3. **Board**, the main screen:
   - **Supply:** 7 small basic piles, then 10 kingdom piles, each with a count badge (`04` light, `08` dark).
   - **Opponents strip:** name, online dot, and hand / deck / discard counts with the top discard card.
   - **Play area:** cards played this turn by the current player.
   - **Log:** a scrolling, numbered list such as "Ana joga Cobre, Cobre", in a column on the right on desktop.
   - **Turn bar** (`05`): "Sua vez" or "Vez de X", the phase (Action/Buy), Actions n, Buys n, $n, and the *Play all Treasures* and *End Actions* / *End turn* buttons. The host also has *End game*.
   - **Banner:** "Aguardando Ana: …" while another player decides (`07`, dark).
   - **Error toast** for refused moves, with a dismiss button.
   - **Hand:** the cards, with playable ones highlighted, plus "Deck n · Discard n".
   - **Phone layout:** a single column with Hand / Supply / Log tabs at the top; the hand scrolls sideways.
4. **Prompt dialog** (`06`): a modal over the board with a title (the instruction) and a hint ("Escolha até 4 cartas."). It has four variants:
   - **choose cards:** a selectable card row and *Confirm*;
   - **choose a Supply pile:** a card row of piles, plus *Skip* when optional;
   - **choose an option:** the cards involved, then option buttons such as Reveal / Don't reveal or Trash / Discard / Put back;
   - **order cards:** click in order, see numbered badges, then *Reset* or *Confirm*.
5. **End screen:** the winner title ("Ana venceu!" or a shared victory), then a score table (Player, VP, Turns, Breakdown, e.g. "Província ×5 (30)"). The host gets *Play again (same kingdom)* and *Back to lobby*; everyone gets *Leave*.
6. **Connection lost:** a centered message with *Rejoin* and *Back to start* buttons.
7. **Transient states:** "Connecting…", "Joining room…" and "Starting the game…".
8. **Language toggle:** small PT and EN buttons in the top-right corner of every screen.

## 8. Class names the CSS must style
- **Layout:** `.screen`, `.centered`, `.panel`, `.field`, `.actions`, `.home__choices`, `.lobby__header`, `.share`, `.seats`, `.dot`, `.dot--on`, `.picker`, `.picker__bar`, `.card-grid`, `.card-row`, `.table-wrap`.
- **Cards:** `.card` plus `.card--{action|treasure|victory|curse|attack|reaction}`, `.card--normal` or `.card--small`, and `.is-highlight`, `.is-selected`, `.is-dimmed`, `.is-clickable`. Parts are `.card__cost`, `.card__name`, `.card__text`, `.card__types` and `.card__badge`.
- **Board:** `.board` plus `.board--tab-{hand|supply|log}`, and the areas `.board__tabs`, `.board__supply`, `.board__opponents`, `.board__play`, `.board__log`, `.board__turn` and `.board__hand`. Inside these: `.supply`, `.supply__basics`, `.supply__kingdom`, `.opponents` (`li.is-current`), `.log`, `.turnbar`, `.turnbar__phase`, `.banner`, `.toast`, `.hand` and `.piles`.
- **Dialog:** `.overlay` and `.prompt`.
- **End screen:** `.scores` (`tr.is-winner`).
- **Toggle:** `.lang-toggle`.
- **Buttons:** `button` and `button.primary`.

New class names are fine; list them so they can be wired into the React components.

## 9. Known visual problems to solve
- **Weak playable highlight:** the 2px accent border barely shows on light Action cards (see Expurgo in `05`).
- **Bad hyphenation in narrow cards:** "Comercian-te", "Saqueado-res", "Proprie-dade".
- **Clipped type line:** "AÇÃO · ATAC…", where the count badge overlaps the type line.
- **Uneven card heights** in the Supply rows, because rule text length varies a lot.
- **The Supply is very tall on desktop:** 10 large kingdom cards push the hand below the fold, and the hand and turn bar are what matter most on your turn.
- **No visual hierarchy between zones.** Supply, play area, log and hand all look alike.
- **The "End game" button** is a full-width plain bar. It should be small and clearly dangerous.
- **The log is plain text,** and could show card names as chips.
- **The game feels flat.** There's no card art, no motion, and no sense of a table.

## 10. How to hand back
- **Preferred:** a Claude Design project or design-system link. Or tokens and component CSS that drop into `src/styles.css`, plus a short spec per screen.
- **Card art:** one image per card id, named `cards/<id>.webp` (e.g. `cards/throne_room.webp`), at the aspect ratio of the art slot you design.
- **Theme names:** a table of `id → { pt name, en name }`. Rule wording should stay mechanically identical, only re-voiced if needed.
- **Implementation:** a Claude Code session implements it. The UI is React 19 with plain CSS, and per-card art and names are data-driven.
