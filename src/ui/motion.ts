import type { CardId } from '../engine/types';
import type { PlayerView } from '../engine/view';

/** A card leaving your hand or the play area, by its position in the previous view. */
export interface Flight {
  card: CardId;
  from: 'hand' | 'play';
  index: number;
  /** Your deck (Bureaucrat, Artisan) or the owner's discard pile. */
  to: 'discard' | 'deck';
  /** Whose discard pile: yours, or an opponent's after their Clean-up. */
  player: number;
}

export interface CardMotion {
  /** Positions in the new hand of cards drawn from your deck. */
  drawn: number[];
  flights: Flight[];
  /** Cards discarded straight from your deck (Vassal, Sentry, Library…). */
  deckToDiscard: number;
}

/** More cards than this flying off the deck at once would just be noise. */
const MAX_DECK_TO_DISCARD = 6;

const NONE: CardMotion = { drawn: [], flights: [], deckToDiscard: 0 };

function counts(cards: CardId[]): Map<CardId, number> {
  const m = new Map<CardId, number>();
  for (const c of cards) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
}

/** Removes one `card` from the multiset; false if there was none left. */
function take(m: Map<CardId, number>, card: CardId): boolean {
  const n = m.get(card) ?? 0;
  if (n === 0) return false;
  m.set(card, n - 1);
  return true;
}

function added(next: CardId[], prev: CardId[]): Map<CardId, number> {
  const old = counts(prev);
  return counts(next.filter((c) => !take(old, c)));
}

/**
 * What moved between two views of the same game, worked out from the zones alone:
 * the engine only sends snapshots, so this guesses the way a player watching the table would.
 */
export function cardMotion(prev: PlayerView, next: PlayerView): CardMotion {
  if (prev.you !== next.you || prev.players.length !== next.players.length || next.result) return NONE;
  const you = next.you;
  const before = prev.players[you];
  const after = next.players[you];
  const trashed = added(next.trash, prev.trash);
  const flights: Flight[] = [];

  // The play area shows the player whose turn it was; whatever left it (and wasn't trashed) was discarded.
  const owner = prev.turn.player;
  const stillInPlay = counts(next.players[owner].inPlay);
  prev.players[owner].inPlay.forEach((card, index) => {
    if (!take(stillInPlay, card) && !take(trashed, card)) flights.push({ card, from: 'play', index, to: 'discard', player: owner });
  });

  // Your Clean-up discards the whole hand and draws a new one, even if some cards look alike.
  const cleanedUp = owner === you && next.turn.player !== you;
  const kept = counts(cleanedUp ? [] : next.hand);
  const played = added(after.inPlay, before.inPlay);
  const left = prev.hand.map((card, index) => ({ card, index })).filter(({ card }) => !take(kept, card) && !take(played, card) && !take(trashed, card));
  // The discard pile only shrinks when it is shuffled into a new deck.
  const reshuffled = after.discardCount < before.discardCount;
  const toDeck = reshuffled ? 0 : Math.min(left.length, Math.max(0, after.deckCount - before.deckCount));
  left.forEach(({ card, index }, i) =>
    flights.push({ card, from: 'hand', index, to: i >= left.length - toDeck ? 'deck' : 'discard', player: you }),
  );

  // New hand cards came from the deck unless the Supply lost one (Mine, Artisan gain into your hand).
  const gained = new Map<CardId, number>();
  for (const [card, n] of Object.entries(prev.supply)) gained.set(card, Math.max(0, n - (next.supply[card] ?? 0)));
  const old = counts(cleanedUp ? [] : prev.hand);
  const drawn: number[] = [];
  next.hand.forEach((card, i) => {
    if (!take(old, card) && !take(gained, card)) drawn.push(i);
  });

  let deckToDiscard = 0;
  if (!reshuffled) {
    const toMyDiscard = flights.filter((f) => f.player === you && f.to === 'discard').length;
    // Bought or gained cards also land in a discard pile; count them all against yours to never invent a flight.
    const otherGains = [...gained.values()].reduce((a, b) => a + b, 0);
    const deckSpent = Math.max(0, before.deckCount - after.deckCount - drawn.length);
    deckToDiscard = Math.min(MAX_DECK_TO_DISCARD, deckSpent, Math.max(0, after.discardCount - before.discardCount - toMyDiscard - otherGains));
  }

  return { drawn, flights, deckToDiscard };
}
