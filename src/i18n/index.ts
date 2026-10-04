import type { CardId, CardType, LogEntry } from '../engine/types';
import en from './en';
import type { UiKey } from './en';
import pt from './pt';
import type { Dictionary, Lang, Params } from './types';

export type { UiKey } from './en';
export type { Dictionary, Lang, Params } from './types';

export const DICTIONARIES: Record<Lang, Dictionary> = { pt, en };

/** Replaces `{name}` placeholders; params that are not supplied stay literal. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(params, k) ? String(params[k]) : m));
}

export interface Translator {
  lang: Lang;
  t(key: UiKey, params?: Params): string;
  card(id: CardId): string;
  cardText(id: CardId): string;
  cardType(type: CardType): string;
  prompt(p: { id: string; message: string; params?: Params }): string;
  option(p: { optionIds: string[]; options: string[] }, index: number): string;
  logLine(entry: LogEntry, names: string[]): string;
  /** The translated verb or sentence of a log entry, without player or cards. */
  logText(text: string): string;
  reason(text: string): string;
}

const own = <T>(o: Record<string, T>, k: string | undefined): T | undefined => (k !== undefined && Object.hasOwn(o, k) ? o[k] : undefined);

export function translator(lang: Lang): Translator {
  const d = DICTIONARIES[lang];
  const card = (id: CardId): string => own(d.cards, id)?.name ?? id;
  return {
    lang,
    t: (key, params) => interpolate(d.ui[key], params),
    card,
    cardText: (id) => own(d.cards, id)?.text ?? '',
    cardType: (type) => d.types[type],
    prompt: (p) => {
      const tpl = own(d.prompts, p.id);
      return tpl === undefined ? p.message : interpolate(tpl, p.params);
    },
    option: (p, index) => own(d.options, p.optionIds[index]) ?? p.options[index],
    logLine: (entry, names) => {
      const who = entry.player === null ? '' : `${names[entry.player] ?? '—'} `;
      const cards = entry.cards && entry.cards.length > 0 ? ` ${entry.cards.map(card).join(', ')}` : '';
      return `${who}${own(d.log, entry.text) ?? entry.text}${cards}`;
    },
    logText: (text) => own(d.log, text) ?? text,
    reason: (text) => {
      const exact = own(d.reasons, text);
      if (exact !== undefined) return exact;
      const m = /^Choose between (\d+) and (\d+) cards$/.exec(text);
      return m ? interpolate(d.reasons['Choose between {min} and {max} cards'], { min: m[1], max: m[2] }) : text;
    },
  };
}
