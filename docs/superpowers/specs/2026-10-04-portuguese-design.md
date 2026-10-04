# Portuguese (pt-BR) Support — Design

**Date:** 2026-10-04
**Status:** Approved in chat

## Goal
Every player can play in Brazilian Portuguese or English. Portuguese is the default, and an EN/PT toggle on every screen saves the choice per browser. Language is per player, so two players in the same game can use different languages.

## Decisions
- **Default language:** Portuguese for everyone, with an English toggle (option B).
- **Card names and text:** translated as well. The placeholder card names get Portuguese equivalents, and rule text is translated (option A).
- **Engine messages:** the engine attaches stable IDs to its messages, and each player's screen translates them locally (approach 1). The host never translates anything.

## Engine changes (additive)
- Every `Prompt` gains `id: string` and `params?: Record<string, string | number>`. The English `message` stays, for tests and as a fallback.
- `chooseOption` prompts gain `optionIds: string[]`, parallel to `options`.
- `EffectContext.chooseOption` takes `{ id, message, options, optionIds, cards? }`. `chooseFromHand`, `chooseCards`, `chooseSupply` and `orderCards` take an `id` and optional `params`.
- Log entries are unchanged. Their `text` values are already a closed set of phrases, so they double as translation keys.
- Game behavior is unchanged, and all existing tests keep passing, with prompt shapes updated to include the new fields.

**Prompt IDs:** discardDownTo{n}, trashRevealedTreasure, topdeckVictory, cellarDiscard, trashCopper, discardForEmptyPiles{n}, gainUpTo{cost}, harbingerTopdeck, vassalPlay, librarySetAside, sentryChoice, orderTopdeck, trashUpTo4, trashFromHand, mineTrash, gainTreasureToHand{cost}, gainToHandUpTo{cost}, topdeckFromHand, throneRoomChoose, revealReaction.

**Option IDs:** playIt, leaveIt, setAside, keepIt, trash, discard, putBack, reveal, dontReveal.

## Translation layer: `src/i18n/`
- `en.ts` and `pt.ts` share one `Dictionary` type, so TypeScript rejects a missing key. They hold:
  - `ui`: interface strings with `{param}` placeholders;
  - `prompts`, `options`, `log` and `reasons`;
  - `cards`: `{ name, text }` for all 33 cards;
  - `types`: card type labels.
- `reasons` maps the exact English rejection and connection-error strings to translations. Unknown reasons fall back to the original English.
- `index.ts` provides `Lang = 'pt' | 'en'`, `translator(lang)` (returning `t`, `card`, `cardText`, `cardType`, `prompt`, `option`, `logLine` and `reason`), `LangProvider` and `useLang()`. The provider saves the choice under the localStorage key `dmf-lang` and sets `<html lang>` and `document.title`.
- `src/theme/index.ts` stays as the English placeholder names. The English dictionary's card names come from it.

## UI
- Every user-visible string in `src/ui` goes through the translator. This covers:
  - all screens, the turn bar, the choice dialog, the log and the opponents strip;
  - the waiting and offline banners, error toasts, connection errors and the end-screen table;
  - `window.confirm` text and aria-labels.
- A language toggle (`EN | PT`) sits fixed in the top-right corner of every screen.
- `promptSelection.selectionHint` and `format.formatLogEntry` take the translator.

## Testing
- **Key parity:** the `pt` and `en` dictionaries have identical nested keys, enforced by the type and by a test.
- **Coverage:** run the 200 seeded bot games (as in `src/sim/simulation.test.ts`) and fuzz illegal intents. Collect every prompt ID, option ID, log text and rejection reason that occurs, and assert each one exists in both dictionaries. Also assert every card in the registry has a name and text in both.
- **Unit tests:** interpolation, card lookup, log line formatting and selection hints, in both languages.
- **Browser check:** play a turn and a Militia prompt in Portuguese, then toggle to English.

## Out of scope
The rules page and tutorial tips, which don't exist yet; translating player names; and per-room language.
