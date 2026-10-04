# Portuguese (pt-BR) Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every player use Portuguese (the default) or English. Prompts, the log, errors, card names and card text are all translated locally in each player's browser.

**Architecture:**
- The engine tags each prompt with a stable `id` and `params`. Option buttons get `optionIds`, and `waitingOn` carries `id` and `params` too.
- `src/i18n` holds two typed dictionaries and a `translator(lang)`.
- React reads the active translator from a `LangProvider` context, which defaults to `pt` and is saved to localStorage.

**Spec:** `docs/superpowers/specs/2026-10-04-portuguese-design.md`

## Global Constraints

- **Game behavior must not change.** Engine edits only add fields (`id`, `params`, `optionIds`) and change helper signatures. Every existing engine, card, net and sim test keeps passing; only prompt-shape literals in tests may be updated.
- **Card effect files keep importing types only** from `cards/types.ts` and `engine/types.ts`.
- **Layering:** `src/i18n` may import from `engine` (types), `cards` (registry, for tests) and `theme`. It never imports from `ui` or `net`, except types.
- **Dictionaries:** `pt.ts` and `en.ts` both satisfy one `Dictionary` type. Placeholders use `{name}` syntax, and missing params are left as the literal `{name}`.
- **Language:** the default is `'pt'`, stored in localStorage key `dmf-lang`, and it sets `document.documentElement.lang` to `pt-BR` or `en`.
- **Commits:** every commit ends with `-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- **Verification after every task:** `npm test && npm run typecheck && npm run build`.

---

### Task 1: Engine prompt IDs

**Files:**
- Modify: `src/engine/types.ts`, `src/cards/types.ts`, `src/engine/context.ts`, `src/engine/view.ts`
- Modify: `src/cards/effects/{simple,hand,transform,attacks,look}.ts`
- Modify (test literals only): `src/engine/prompts.test.ts`, `src/engine/view.test.ts`, `src/ui/promptSelection.test.ts`, and any test whose expected prompt shape uses `toEqual`. `toMatchObject` assertions keep working.
- Test: `src/engine/promptIds.test.ts`

**Interfaces produced:**
```ts
// engine/types.ts — added to EVERY Prompt variant:
id: string;
params?: Record<string, string | number>;
// chooseOption variant additionally:
optionIds: string[];
// engine/view.ts
waitingOn: { player: number; message: string; id: string; params?: Record<string, string | number> } | null
// cards/types.ts
interface ChooseFromHandOptions { id: string; params?: Record<string, string | number>; min; max; message; filter? }
interface ChooseCardsOptions    { id: string; params?: …; min; max; message; selectable? }
interface ChooseSupplyOptions   { id: string; params?: …; maxCost; message; optional?; type? }
interface ChooseOptionSpec      { id: string; message: string; options: string[]; optionIds: string[]; cards?: CardId[] }
chooseOption(player: number, spec: ChooseOptionSpec): Gen<number>
orderCards(player: number, cards: CardId[], spec: { id: string; message: string }): Gen<CardId[]>
```

**Prompt and option IDs.** Use these exactly. The English message text stays the same as today.

| Where | id | params | optionIds |
|---|---|---|---|
| militia (attacks.ts) | `discardDownTo` | `{ n }` | |
| bandit | `trashRevealedTreasure` | | |
| bureaucrat | `topdeckVictory` | | |
| cellar (hand.ts) | `cellarDiscard` | | |
| moneylender | `trashCopper` | | |
| poacher | `discardForEmptyPiles` | `{ n }` | |
| workshop | `gainUpTo` | `{ cost: 4 }` | |
| harbinger | `harbingerTopdeck` | | |
| vassal | `vassalPlay` | | `['playIt','leaveIt']` |
| library (look.ts) | `librarySetAside` | | `['setAside','keepIt']` |
| sentry choice | `sentryChoice` | | `['trash','discard','putBack']` |
| sentry order | `orderTopdeck` | | |
| chapel (simple.ts) | `trashUpTo4` | | |
| remodel trash (transform.ts) | `trashFromHand` | | |
| remodel gain | `gainUpTo` | `{ cost: maxCost }` | |
| mine trash | `mineTrash` | | |
| mine gain | `gainTreasureToHand` | `{ cost: maxCost }` | |
| artisan gain | `gainToHandUpTo` | `{ cost: 5 }` | |
| artisan topdeck | `topdeckFromHand` | | |
| throne room | `throneRoomChoose` | | |
| Moat in `attackedOpponents` (context.ts) | `revealReaction` | | `['reveal','dontReveal']` |

- [ ] **Step 1: Write the failing test** `src/engine/promptIds.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { KINGDOM_IDS } from '../cards/registry';
import { createRng, shuffle } from './rng';
import { Game } from './game';
import { botMove } from '../sim/bigMoney';
import { viewFor } from './view';

describe('prompt ids', () => {
  it('every prompt in 100 bot games has an id, and option prompts have matching optionIds', () => {
    let prompts = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const n = 2 + (seed % 3);
      const game = Game.create({
        players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `B${i}` })),
        kingdom: shuffle(createRng(seed), KINGDOM_IDS).slice(0, 10),
        seed,
      });
      for (let step = 0; step < 20000 && !game.state.result; step++) {
        const p = game.state.pending;
        if (p) {
          prompts++;
          expect(typeof p.id, JSON.stringify(p)).toBe('string');
          expect(p.id.length).toBeGreaterThan(0);
          if (p.kind === 'chooseOption') expect(p.optionIds).toHaveLength(p.options.length);
          const other = game.state.players[(p.player + 1) % n].id;
          const waiting = viewFor(game.state, other).waitingOn;
          if (other !== game.state.players[p.player].id) expect(waiting).toMatchObject({ id: p.id });
        }
        const { playerId, intent } = botMove(game);
        game.apply(playerId, intent);
      }
    }
    expect(prompts).toBeGreaterThan(500);
  });
});
```
- [ ] **Step 2:** Run `npx vitest run src/engine/promptIds.test.ts`. Expect it to FAIL, because `id` is undefined.
- [ ] **Step 3:** Implement the types, context helpers, `viewFor` and all effect call sites per the table. In `context.ts`, each helper copies `id` and `params` (only when provided) into the yielded prompt. `chooseFromHand` forwards `id` and `params` to `chooseCards`. `chooseOption` yields `{ kind: 'chooseOption', player, id, message, options, optionIds, cards? }`; omit `cards` when not given, as today. In `view.ts`, `waitingOn` becomes `{ player, message, id, params }`, and `params` is included only when defined, so `toEqual` stays stable.
- [ ] **Step 4:** Update the test literals that now need `id` (and `optionIds`). Also update the `view.test.ts` `waitingOn` expectations to `{ player: 1, message: 'Discard 2 card(s), down to 3', id: 'discardDownTo', params: { n: 2 } }`. Do not weaken any assertion.
- [ ] **Step 5:** Run `npm test && npm run typecheck && npm run build`. Expect all to pass.
- [ ] **Step 6:** Commit `feat(engine): stable ids and params on prompts for translation`.

---

### Task 2: i18n core: dictionaries, translator, coverage tests

**Files:**
- Create: `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/pt.ts`, `src/i18n/index.ts`, `src/i18n/LangProvider.tsx`
- Test: `src/i18n/i18n.test.ts`, `src/i18n/coverage.test.ts`

**Interfaces produced:**
```ts
// types.ts
export type Lang = 'pt' | 'en';
export type Params = Record<string, string | number>;
export interface Dictionary {
  ui: Record<UiKey, string>;               // UiKey = keyof typeof en.ui (define en.ui first, export `type UiKey`)
  prompts: Record<string, string>;
  options: Record<string, string>;
  log: Record<string, string>;
  reasons: Record<string, string>;         // exact English text → translation
  types: Record<CardType, string>;
  cards: Record<CardId, { name: string; text: string }>;
}
// index.ts
export interface Translator {
  lang: Lang;
  t(key: UiKey, params?: Params): string;
  card(id: CardId): string;
  cardText(id: CardId): string;
  cardType(type: CardType): string;
  prompt(p: { id: string; message: string; params?: Params }): string;   // falls back to p.message
  option(p: { optionIds: string[]; options: string[] }, index: number): string; // falls back to options[i]
  logLine(entry: LogEntry, names: string[]): string;
  reason(text: string): string;            // falls back to text
}
export function translator(lang: Lang): Translator;
export function interpolate(template: string, params?: Params): string;
export const DICTIONARIES: Record<Lang, Dictionary>;
// LangProvider.tsx
export function LangProvider({ children }): JSX.Element;   // default 'pt', persists 'dmf-lang', sets <html lang> + document.title (= t('appName'))
export function useLang(): { lang: Lang; setLang(l: Lang): void; tr: Translator };
```
`logLine` formats as `${names[player] ?? '?'} ${log[text] ?? text}` plus `' ' + cards.map(card).join(', ')` when there are cards. A `null` player means no name prefix.

**Dictionary content.** Use these strings verbatim. The English UI strings must reproduce the current UI text exactly.

`ui` keys (en → pt):
| key | en | pt |
|---|---|---|
| appName | Dominion Friends | Dominion Friends |
| tagline | A deck-building card game for 2–4 friends. | Um jogo de cartas de construção de baralho para 2 a 4 amigos. |
| yourName | Your name | Seu nome |
| namePlaceholder | Player | Jogador |
| hostTitle | Host a game | Criar uma partida |
| hostBlurb | Create a room and share the link with your friends. | Crie uma sala e compartilhe o link com seus amigos. |
| hostButton | Host game | Criar partida |
| joinTitle | Join a game | Entrar em uma partida |
| roomCode | Room code | Código da sala |
| joinButton | Join | Entrar |
| connecting | Connecting… | Conectando… |
| room | Room {code} | Sala {code} |
| leave | Leave | Sair |
| invite | Invite friends | Convide amigos |
| shareLink | Share link | Link de convite |
| copyLink | Copy link | Copiar link |
| copied | Copied | Copiado |
| players | Players ({n}/4) | Jogadores ({n}/4) |
| hostTag | (host) | (anfitrião) |
| youTag | (you) | (você) |
| kingdom | Kingdom | Reino |
| chosen | {n}/10 chosen | {n}/10 escolhidas |
| randomize | Randomize | Sortear |
| startGame | Start game | Começar partida |
| needPlayer | Waiting for at least one more player… | Aguardando pelo menos mais um jogador… |
| choose10 | Choose 10 kingdom cards. | Escolha 10 cartas de reino. |
| waitingHostStart | Waiting for the host to start… | Aguardando o anfitrião começar… |
| joiningRoom | Joining room {code}… | Entrando na sala {code}… |
| startingGame | Starting the game… | Iniciando a partida… |
| connectionLost | Connection lost | Conexão perdida |
| connectionLostBody | The host may have left, or your connection dropped. If the game is still running, you can rejoin. | O anfitrião pode ter saído ou sua conexão caiu. Se a partida ainda estiver rolando, você pode voltar. |
| rejoin | Rejoin | Voltar à partida |
| rejoining | Rejoining… | Voltando… |
| backToStart | Back to start | Voltar ao início |
| tabHand | Hand | Mão |
| tabSupply | Supply | Suprimento |
| tabLog | Log | Registro |
| yourPlayArea | Your play area | Sua área de jogo |
| playArea | {name}'s play area | Área de jogo de {name} |
| yourTurn | Your turn | Sua vez |
| turnOf | {name}'s turn | Vez de {name} |
| actionPhase | Action phase | Fase de ação |
| buyPhase | Buy phase | Fase de compra |
| actions | Actions {n} | Ações {n} |
| buys | Buys {n} | Compras {n} |
| playAllTreasures | Play all Treasures | Jogar todos os Tesouros |
| endActions | End Actions | Encerrar ações |
| endTurn | End turn | Encerrar turno |
| endGame | End game | Encerrar partida |
| endGameConfirm | End the game for everyone and return to the lobby? | Encerrar a partida para todos e voltar ao saguão? |
| waitingFor | Waiting for {name}: {message} | Aguardando {name}: {message} |
| waitingForOffline | Waiting for {name} (offline)… | Aguardando {name} (desconectado)… |
| offlineSuffix | (offline) | (desconectado) |
| dismiss | Dismiss | Fechar |
| deckDiscard | Deck {deck} · Discard {discard} | Baralho {deck} · Descarte {discard} |
| discardTop | (top: {card}) | (topo: {card}) |
| oppCounts | Hand {hand} · Deck {deck} · Discard {discard} | Mão {hand} · Baralho {deck} · Descarte {discard} |
| gameLog | Game log | Registro da partida |
| confirm | Confirm | Confirmar |
| reset | Reset | Limpar |
| skip | Skip | Pular |
| hintOrder | Click the cards in order, starting with the one to put on top. | Clique nas cartas em ordem, começando pela que fica no topo. |
| hintExact1 | Choose 1 card. | Escolha 1 carta. |
| hintExact | Choose {n} cards. | Escolha {n} cartas. |
| hintUpTo1 | Choose up to 1 card. | Escolha até 1 carta. |
| hintUpTo | Choose up to {n} cards. | Escolha até {n} cartas. |
| hintRange | Choose {min} to {max} cards. | Escolha de {min} a {max} cartas. |
| wins | {name} wins! | {name} venceu! |
| sharedVictory | Shared victory: {names} | Vitória compartilhada: {names} |
| colPlayer | Player | Jogador |
| colVp | VP | PV |
| colTurns | Turns | Turnos |
| colBreakdown | Breakdown | Detalhamento |
| playAgain | Play again (same kingdom) | Jogar de novo (mesmo reino) |
| backToLobby | Back to lobby | Voltar ao saguão |
| waitingHost | Waiting for the host… | Aguardando o anfitrião… |
| language | Language | Idioma |

`prompts` (en is today's message; pt shown):
discardDownTo "Descarte {n} carta(s) até ficar com 3" · trashRevealedTreasure "Coloque no lixo um Tesouro revelado" · topdeckVictory "Coloque uma carta de Vitória da sua mão no topo do baralho" · cellarDiscard "Descarte quantas cartas quiser e compre o mesmo número" · trashCopper "Você pode colocar um Cobre no lixo para receber +$3" · discardForEmptyPiles "Descarte {n} carta(s)" · gainUpTo "Ganhe uma carta que custe até ${cost}" · harbingerTopdeck "Você pode colocar uma carta da sua pilha de descarte no topo do baralho" · vassalPlay "Jogar a carta de Ação descartada?" · librarySetAside "Você comprou uma carta de Ação. Separá-la?" · sentryChoice "O que fazer com esta carta?" · orderTopdeck "Ordene as cartas a devolver (a primeira fica no topo)" · trashUpTo4 "Coloque até 4 cartas da sua mão no lixo" · trashFromHand "Coloque uma carta da sua mão no lixo" · mineTrash "Você pode colocar um Tesouro da sua mão no lixo" · gainTreasureToHand "Ganhe na mão um Tesouro que custe até ${cost}" · gainToHandUpTo "Ganhe na mão uma carta que custe até ${cost}" · topdeckFromHand "Coloque uma carta da sua mão no topo do baralho" · throneRoomChoose "Você pode jogar duas vezes uma carta de Ação da sua mão" · revealReaction "Um ataque está chegando. Revelar sua Reação para bloqueá-lo?"

English `prompts` use the current English messages, with `{n}` and `${cost}` placeholders (e.g. "Gain a card costing up to ${cost}").

`options` (en / pt): playIt Play it / Jogar · leaveIt Leave it / Deixar · setAside Set it aside / Separar · keepIt Keep it / Manter · trash Trash / Lixo · discard Discard / Descartar · putBack Put back / Devolver · reveal Reveal / Revelar · dontReveal Don't reveal / Não revelar

`log`: English is the identity mapping. Portuguese: plays "joga" · buys "compra" · gains "ganha" · discards "descarta" · trashes "coloca no lixo" · reveals "revela" · "puts a card onto their deck" "coloca uma carta no topo do baralho" · "puts a card from their discard pile onto their deck" "coloca uma carta da pilha de descarte no topo do baralho" · "reveals a hand with no Victory cards" "revela uma mão sem cartas de Vitória" · "Game over" "Fim de jogo" · "takes the first turn" "começa jogando"

`reasons`: English is the identity mapping. Portuguese for each:

| en | pt |
|---|---|
| The game is over | A partida acabou |
| Unknown player | Jogador desconhecido |
| Invalid intent | Jogada inválida |
| Waiting for a choice to be made | Aguardando uma escolha |
| It is not your choice to make | Não é você quem escolhe agora |
| This choice can no longer be resumed | Esta escolha não pode mais continuar |
| Nothing to answer | Não há nada para responder |
| It is not your turn | Não é a sua vez |
| Unknown intent | Jogada desconhecida |
| You can only play Actions in your Action phase | Você só pode jogar Ações na fase de ação |
| No such card in hand | Essa carta não está na sua mão |
| That is not an Action card | Essa não é uma carta de Ação |
| No Actions left | Você não tem mais Ações |
| You cannot play Treasures after buying | Você não pode jogar Tesouros depois de comprar |
| That is not a Treasure | Essa não é uma carta de Tesouro |
| No Treasures to play | Não há Tesouros para jogar |
| No such pile | Essa pilha não existe |
| That pile is empty | Essa pilha está vazia |
| No Buys left | Você não tem mais Compras |
| Not enough coins | Moedas insuficientes |
| Invalid answer | Resposta inválida |
| Expected a card selection | Escolha cartas |
| Invalid selection | Seleção inválida |
| Duplicate selection | Seleção repetida |
| That card cannot be chosen | Essa carta não pode ser escolhida |
| Expected a supply pile | Escolha uma pilha |
| You must choose a pile | Você precisa escolher uma pilha |
| That pile cannot be chosen | Essa pilha não pode ser escolhida |
| Expected an option | Escolha uma opção |
| Invalid option | Opção inválida |
| Expected an order | Escolha uma ordem |
| Order must include every card | A ordem precisa incluir todas as cartas |
| Order must include every card once | A ordem precisa incluir cada carta uma vez |
| No game in progress | Nenhuma partida em andamento |
| Game in progress | Partida em andamento |
| Room full | Sala cheia |
| Something went wrong | Algo deu errado |
| Need at least 2 players | São necessários pelo menos 2 jogadores |
| Game already started | A partida já começou |
| The game is not over | A partida ainda não acabou |
| Choose 10 different kingdom cards | Escolha 10 cartas de reino diferentes |
| Room not found. Check the code and try again. | Sala não encontrada. Confira o código e tente de novo. |
| Could not reach the connection server. Check your internet connection and try again. | Não foi possível acessar o servidor de conexão. Verifique sua internet e tente de novo. |
| This browser does not support peer-to-peer connections. | Este navegador não suporta conexões ponto a ponto. |
| Connection failed. | A conexão falhou. |
| Could not connect. The code may be wrong, or your network blocks peer-to-peer connections. | Não foi possível conectar. O código pode estar errado ou sua rede bloqueia conexões ponto a ponto. |

`types` (en / pt): action Action / Ação · treasure Treasure / Tesouro · victory Victory / Vitória · curse Curse / Maldição · attack Attack / Ataque · reaction Reaction / Reação

`cards`: the English names come from `PLACEHOLDER_NAMES` (src/theme) and the English text from `getCard(id).text` (src/cards/data.ts). Build `en.cards` from those at module load so nothing is duplicated. Portuguese (name — text):
- copper Cobre — $1 · silver Prata — $2 · gold Ouro — $3 · estate Propriedade — 1 PV · duchy Ducado — 3 PV · province Província — 6 PV · curse Maldição — -1 PV
- cellar Peneira — +1 Ação. Descarte quantas cartas quiser e depois compre o mesmo número.
- chapel Expurgo — Coloque até 4 cartas da sua mão no lixo.
- moat Escudo — +2 Cartas. Quando outro jogador jogar um Ataque, você pode revelar esta carta da sua mão para não ser afetado.
- harbinger Resgate — +1 Carta, +1 Ação. Olhe sua pilha de descarte. Você pode colocar uma carta dela no topo do seu baralho.
- merchant Comerciante — +1 Carta, +1 Ação. Na primeira vez que você jogar uma Prata neste turno, +$1.
- vassal Servo — +$2. Descarte a carta do topo do seu baralho. Se for uma carta de Ação, você pode jogá-la.
- village Vila — +1 Carta, +2 Ações.
- workshop Oficina — Ganhe uma carta que custe até $4.
- bureaucrat Escrivão — Ganhe uma Prata no topo do seu baralho. Cada outro jogador revela uma carta de Vitória da mão e a coloca no topo do baralho (ou revela uma mão sem cartas de Vitória).
- gardens Jardim — Vale 1 PV para cada 10 cartas que você tiver (arredondado para baixo).
- militia Saqueadores — +$2. Cada outro jogador descarta até ficar com 3 cartas na mão.
- moneylender Agiota — Você pode colocar um Cobre da sua mão no lixo para receber +$3.
- poacher Catador — +1 Carta, +1 Ação, +$1. Descarte uma carta para cada pilha vazia do Suprimento.
- remodel Reconstruir — Coloque uma carta da sua mão no lixo. Ganhe uma carta que custe até $2 a mais que ela.
- smithy Compre Três — +3 Cartas.
- throne_room Eco — Você pode jogar duas vezes uma carta de Ação da sua mão.
- bandit Ladrão — Ganhe um Ouro. Cada outro jogador revela as 2 cartas do topo do baralho, coloca no lixo um Tesouro revelado que não seja Cobre e descarta o resto.
- council_room Conselho — +4 Cartas, +1 Compra. Cada outro jogador compra uma carta.
- festival Festival — +2 Ações, +1 Compra, +$2.
- laboratory Laboratório — +2 Cartas, +1 Ação.
- library Arquivo — Compre até ter 7 cartas na mão, podendo separar cartas de Ação compradas; descarte as separadas no final.
- market Mercado — +1 Carta, +1 Ação, +1 Compra, +$1.
- mine Refinaria — Você pode colocar um Tesouro da sua mão no lixo. Ganhe na mão um Tesouro que custe até $3 a mais que ele.
- sentry Sentinela — +1 Carta, +1 Ação. Olhe as 2 cartas do topo do seu baralho. Coloque no lixo e/ou descarte quantas quiser. Devolva o resto ao topo em qualquer ordem.
- witch Feitiço — +2 Cartas. Cada outro jogador ganha uma Maldição.
- artisan Artesão — Ganhe na mão uma carta que custe até $5. Coloque uma carta da sua mão no topo do seu baralho.

- [ ] **Step 1: Write failing tests.**

`src/i18n/i18n.test.ts` covers:
- `interpolate`, including a missing param staying `{x}`.
- Key parity: recursively compare the key sets of `DICTIONARIES.pt` and `DICTIONARIES.en`; they must be equal.
- `translator('pt').card('smithy') === 'Compre Três'` and `translator('en').card('smithy') === 'Draw Three'`.
- `cardText` in both languages for one card.
- `prompt({ id: 'discardDownTo', message: 'x', params: { n: 2 } })` gives `'Descarte 2 carta(s) até ficar com 3'`. An unknown id falls back to the message.
- `option` returns "Revelar" for index 0 of `{ optionIds: ['reveal','dontReveal'], options: [...] }` in pt.
- `logLine({ player: 0, text: 'plays', cards: ['village','smithy'] }, ['Ana'])` gives `'Ana joga Vila, Compre Três'` in pt and `'Ana plays Village, Draw Three'` in en. A null player gives no prefix.
- `reason('It is not your turn')` gives `'Não é a sua vez'`, and an unknown reason passes through.

`src/i18n/coverage.test.ts` covers:
- For seeds 1–200, play bot games exactly like `src/sim/simulation.test.ts` (2–4 players, random kingdoms, `botMove`).
- Collect every `pending.id`, every `optionIds` entry and every `state.log[].text`.
- Also apply, at random points in those games, a set of illegal intents (out-of-turn endPhase, buy 'gold' with no coins, playAction of a non-action index, answerPrompt with no prompt, a wrong answer kind while a prompt is pending, and so on), and collect every `reason`.
- Assert each collected id, option, log text and reason exists in both `pt` and `en`.
- Assert every card in `BASIC_IDS ∪ KINGDOM_IDS` has a non-empty `name` and `text` in both languages.
- Assert every `CardType` has a label.
- Assert `prompts`, `options` and `log` have no keys beyond what's used, by comparing the en keys with the collected sets plus a documented allowlist. This keeps the dictionaries tidy.

- [ ] **Step 2:** Run the tests and see them fail because the modules are missing.
- [ ] **Step 3:** Implement `types.ts`, `en.ts`, `pt.ts`, `index.ts` and `LangProvider.tsx` with the content above. `LangProvider` reads and writes localStorage inside try/catch, using `'pt'` when the value is unavailable or invalid. It uses a `useEffect` on `lang` to set `document.documentElement.lang` (`pt-BR` or `en`) and `document.title`. `useLang()` outside a provider throws a clear error.
- [ ] **Step 4:** Run `npm test && npm run typecheck && npm run build`. Expect all to pass.
- [ ] **Step 5:** Commit `feat(i18n): Portuguese and English dictionaries with coverage tests`.

---

### Task 3: Translate the UI, add the language toggle, and check in the browser

**Files:**
- Modify: `src/main.tsx` (wrap `<App/>` in `<LangProvider>`), `src/ui/App.tsx`, `src/ui/screens/*.tsx` and `src/ui/components/*.tsx`
- Modify: `src/ui/format.ts`, `src/ui/promptSelection.ts` and their tests
- Modify: `src/styles.css` (toggle styles)
- Create: `src/ui/components/LangToggle.tsx`

**Requirements:**
- `formatLogEntry(entry, names, tr)` delegates to `tr.logLine`.
- `selectionHint(prompt, tr)` uses the hint keys: `hintExact1` and `hintUpTo1` when the count is 1, `hintExact`, `hintUpTo` and `hintRange` otherwise, and `hintOrder`. Update their tests to pass `translator('en')` and keep today's English expectations. Add one pt assertion each.
- Every user-visible string in `src/ui/**/*.tsx` comes from `tr`:
  - visible text, placeholders, aria-labels, `title` attributes and `window.confirm`;
  - card names, card text and type labels (via `tr.card`, `tr.cardText` and `tr.cardType`);
  - prompt messages (`tr.prompt(prompt)`) and option labels (`tr.option(prompt, i)`);
  - waiting banners (`tr.prompt(view.waitingOn)` inside `t('waitingFor', …)`);
  - error toasts and the Home / Connection-lost errors (`tr.reason(error)`);
  - the end-screen table and title.
- Remove direct `cardName` imports from `src/ui`. `sortByCost` may keep using the English placeholder names for a stable order.
- No English literal may remain in `src/ui/**/*.tsx` except `Dominion Friends`, the room-code placeholder `ABCD`, symbols such as `×` and `$`, and the `EN` and `PT` toggle labels. Check with a grep, and include the grep command and its output in the report.
- `LangToggle` is fixed in the top-right corner (`position: fixed; top: 8px; right: 8px; z-index: 20`). It shows two small buttons, `PT` and `EN`, with the active one styled `primary` and the group labelled with `aria-label={t('language')}`. It renders on every screen; App renders it once at the top level of every branch. It must not overlap the Board's turn bar on mobile, so give `.board` and `.screen` enough top padding on mobile, or place the toggle inside the flow there. Check visually.

- [ ] **Step 1:** Update the `format` and `promptSelection` tests (en plus one pt case each). Run them and see them fail. Then implement.
- [ ] **Step 2:** Convert every screen and component, add `LangToggle`, and wire `LangProvider` in `main.tsx`.
- [ ] **Step 3:** Run `npm test && npm run typecheck && npm run build`. Expect all to pass, and run the English-literal grep.
- [ ] **Step 4:** Commit `feat(ui): Portuguese by default with an EN/PT toggle`.
- [ ] **Step 5 (controller): browser check.** Run the dev server with two tabs:
  1. Home is in Portuguese.
  2. Host and join both work.
  3. The lobby is in Portuguese, including card names and text.
  4. During the game, the turn bar, log and Militia prompt are in Portuguese, and the attacker sees "Aguardando …".
  5. Switching one tab to EN switches only that tab, and the choice is remembered after a reload.
  6. In the phone layout, the toggle doesn't overlap anything.
