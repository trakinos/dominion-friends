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
