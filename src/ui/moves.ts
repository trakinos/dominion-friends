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
