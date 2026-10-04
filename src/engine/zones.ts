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
