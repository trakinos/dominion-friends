import type { CardId, CardType, GameState, Prompt, PromptAnswer } from '../engine/types';

export type Gen<T = void> = Generator<Prompt, T, PromptAnswer>;
export type Effect = (ctx: EffectContext) => Gen;

export interface CardData {
  id: CardId;
  cost: number;
  types: CardType[];
  /** Rule text shown on the card. */
  text: string;
  coins?: number;
  vp?: number | ((owned: CardId[]) => number);
}

export interface CardDef extends CardData {
  play?: Effect;
}

export interface ChooseFromHandOptions {
  min: number;
  max: number;
  message: string;
  filter?: (card: CardId) => boolean;
}

export interface ChooseCardsOptions {
  min: number;
  max: number;
  message: string;
  /** Defaults to every index. */
  selectable?: number[];
}

export interface ChooseSupplyOptions {
  maxCost: number;
  message: string;
  optional?: boolean;
  type?: CardType;
}

/**
 * Everything a card effect may do. Card files import this as a type only;
 * the engine supplies the implementation (engine/context.ts).
 */
export interface EffectContext {
  /** Index of the player whose card is resolving. */
  readonly me: number;
  readonly state: GameState;
  /** Other players in turn order, starting at my left. */
  opponents(): number[];
  cost(card: CardId): number;
  isType(card: CardId, type: CardType): boolean;
  draw(player: number, n: number): CardId[];
  addActions(n: number): void;
  addBuys(n: number): void;
  addCoins(n: number): void;
  /** Gains from the Supply. Returns false if the pile is empty. */
  gain(player: number, card: CardId, to?: 'discard' | 'hand' | 'deck'): boolean;
  trashFromHand(player: number, handIndices: number[]): CardId[];
  discardFromHand(player: number, handIndices: number[]): CardId[];
  topdeckFromHand(player: number, handIndex: number): CardId;
  /** Removes up to n cards from the top of the deck, reshuffling if needed. */
  takeFromDeck(player: number, n: number): CardId[];
  /** cards[0] ends on top. */
  putOnDeck(player: number, cards: CardId[]): void;
  discardCards(player: number, cards: CardId[]): void;
  trashCards(player: number, cards: CardId[]): void;
  emptySupplyPiles(): number;
  log(player: number | null, text: string, cards?: CardId[]): void;
  /** Returns chosen hand indices. Skips the prompt when nothing or everything must be chosen. */
  chooseFromHand(player: number, opts: ChooseFromHandOptions): Gen<number[]>;
  /** Returns chosen indices into `cards`. Same skipping rules as chooseFromHand. */
  chooseCards(player: number, cards: CardId[], opts: ChooseCardsOptions): Gen<number[]>;
  /** Returns null when no pile qualifies, or when optional and declined. */
  chooseSupply(player: number, opts: ChooseSupplyOptions): Gen<CardId | null>;
  chooseOption(player: number, message: string, options: string[], cards?: CardId[]): Gen<number>;
  /** Returns the cards in the chosen order (first = top). No prompt for 0–1 cards. */
  orderCards(player: number, cards: CardId[], message: string): Gen<CardId[]>;
  /** Asks Moat holders whether to reveal; returns the opponents the attack hits, in turn order. */
  attackedOpponents(): Gen<number[]>;
  /** Resolves a card's effect. The caller is responsible for moving the card into play. */
  playCard(card: CardId): Gen;
}
