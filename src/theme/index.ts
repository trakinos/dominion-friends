import type { CardId } from '../engine/types';

/**
 * The "Feira" theme (a Brazilian street market): card names in both languages.
 * Mechanics are unchanged; only names and the wording that cites them differ.
 */
export const THEME_NAMES: Record<CardId, { pt: string; en: string }> = {
  copper: { pt: 'Centavo', en: 'Cent' },
  silver: { pt: 'Moeda', en: 'Coin' },
  gold: { pt: 'Nota', en: 'Bill' },
  estate: { pt: 'Banca', en: 'Stand' },
  duchy: { pt: 'Barraca', en: 'Stall' },
  province: { pt: 'Mercadão', en: 'Grand Market' },
  curse: { pt: 'Fiado', en: 'IOU' },
  cellar: { pt: 'Troca-troca', en: 'Swap' },
  chapel: { pt: 'Faxina', en: 'Clean-out' },
  moat: { pt: 'Guarda-chuva', en: 'Umbrella' },
  harbinger: { pt: 'Repescagem', en: 'Second Look' },
  merchant: { pt: 'Freguês', en: 'Regular' },
  vassal: { pt: 'Ajudante', en: 'Helper' },
  village: { pt: 'Mutirão', en: 'Work Party' },
  workshop: { pt: 'Escambo', en: 'Barter' },
  bureaucrat: { pt: 'Fiscal', en: 'Inspector' },
  gardens: { pt: 'Horta', en: 'Veggie Patch' },
  militia: { pt: 'Rapa', en: 'Crackdown' },
  moneylender: { pt: 'Agiota', en: 'Loan Shark' },
  poacher: { pt: 'Catador', en: 'Scavenger' },
  remodel: { pt: 'Reforma', en: 'Renovation' },
  smithy: { pt: 'Caixote', en: 'Crate' },
  throne_room: { pt: 'Bis', en: 'Encore' },
  bandit: { pt: 'Trombadinha', en: 'Pickpocket' },
  council_room: { pt: 'Assembleia', en: 'Assembly' },
  festival: { pt: 'Quermesse', en: 'Fair Night' },
  laboratory: { pt: 'Pastelaria', en: 'Pastry Stand' },
  library: { pt: 'Sebo', en: 'Bookstall' },
  market: { pt: 'Xepa', en: 'Last Call' },
  mine: { pt: 'Câmbio', en: 'Exchange' },
  sentry: { pt: 'Vigia', en: 'Lookout' },
  witch: { pt: 'Caloteiro', en: 'Deadbeat' },
  artisan: { pt: 'Artesão', en: 'Artisan' },
};

/** English rule text that names other cards, re-voiced with the theme's names. */
export const EN_TEXT_OVERRIDES: Partial<Record<CardId, string>> = {
  merchant: '+1 Card, +1 Action. The first time you play a Coin this turn, +$1.',
  bureaucrat:
    'Gain a Coin onto your deck. Each other player reveals a Victory card from their hand and puts it onto their deck (or reveals a hand with no Victory cards).',
  moneylender: 'You may trash a Cent from your hand for +$3.',
  poacher: '+1 Card, +1 Action, +$1. Discard a card per empty Market pile.',
  bandit: 'Gain a Bill. Each other player reveals the top 2 cards of their deck, trashes a revealed Treasure other than Cent, and discards the rest.',
  witch: '+2 Cards. Each other player gains an IOU.',
};

/** Stable English name, used for sorting and as the fallback outside the dictionaries. */
export function cardName(id: CardId): string {
  return Object.hasOwn(THEME_NAMES, id) ? THEME_NAMES[id].en : id;
}

export type ChipKind = 'card' | 'action' | 'buy' | 'coin';
export interface RuleChip {
  kind: ChipKind;
  n: number;
}

const CHIP_WORDS: [RegExp, ChipKind][] = [
  [/^(cards?|cartas?)$/i, 'card'],
  [/^(actions?|ação|ações)$/i, 'action'],
  [/^(buys?|compras?)$/i, 'buy'],
];

/**
 * Splits the leading "+1 Card, +1 Action, +$1." bonuses off a rule text so the
 * card frame can show them as icon chips. Works for both languages.
 */
export function splitRuleText(text: string): { chips: RuleChip[]; rest: string } {
  const chips: RuleChip[] = [];
  let rest = text.trim();
  const token = /^\+(\$?)(\d+)(?:\s+([\p{L}]+))?\s*([,.]\s*|$)/u;
  for (let m = token.exec(rest); m; m = token.exec(rest)) {
    const [whole, dollar, num, word] = m;
    let kind: ChipKind | undefined;
    if (dollar && !word) kind = 'coin';
    else if (!dollar && word) kind = CHIP_WORDS.find(([re]) => re.test(word))?.[1];
    if (!kind) break;
    chips.push({ kind, n: Number(num) });
    rest = rest.slice(whole.length);
  }
  return { chips, rest: rest.trim() };
}
