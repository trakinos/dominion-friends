import type { CardId, CardType } from '../engine/types';
import type { UiKey } from './en';

export type Lang = 'pt' | 'en';
export type Params = Record<string, string | number>;

export interface Dictionary {
  ui: Record<UiKey, string>;
  prompts: Record<string, string>;
  options: Record<string, string>;
  log: Record<string, string>;
  /** Exact English text -> translation. */
  reasons: Record<string, string>;
  types: Record<CardType, string>;
  cards: Record<CardId, { name: string; text: string }>;
}
