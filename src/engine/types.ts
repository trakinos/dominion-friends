import type { RngState } from './rng';

export type CardId = string;
export type CardType = 'action' | 'treasure' | 'victory' | 'curse' | 'attack' | 'reaction';
export type Phase = 'action' | 'buy';

export interface PlayerState {
  id: string;
  name: string;
  /** deck[0] is the top card. */
  deck: CardId[];
  hand: CardId[];
  /** The last element is the top card. */
  discard: CardId[];
  inPlay: CardId[];
  turnsTaken: number;
}

export interface TurnState {
  player: number;
  phase: Phase;
  actions: number;
  buys: number;
  coins: number;
  /** Once true, no more Treasures may be played this turn. */
  boughtThisTurn: boolean;
  /** Merchants played this turn; each adds +$1 to the first Silver. */
  merchants: number;
  silverPlayed: boolean;
}

export type Prompt =
  | {
      kind: 'chooseCards';
      player: number;
      message: string;
      cards: CardId[];
      /** Indices into `cards` that may be chosen. */
      selectable: number[];
      min: number;
      max: number;
    }
  | { kind: 'chooseSupply'; player: number; message: string; piles: CardId[]; optional: boolean }
  | { kind: 'chooseOption'; player: number; message: string; options: string[]; cards?: CardId[] }
  | { kind: 'orderCards'; player: number; message: string; cards: CardId[] };

export type PromptAnswer =
  | { kind: 'cards'; indices: number[] }
  | { kind: 'supply'; card: CardId | null }
  | { kind: 'option'; index: number }
  /** order[k] is an index into the prompt's cards; the first entry ends on top. */
  | { kind: 'order'; order: number[] };

export type Intent =
  | { type: 'playAction'; handIndex: number }
  | { type: 'playTreasure'; handIndex: number }
  | { type: 'playAllTreasures' }
  | { type: 'buy'; card: CardId }
  | { type: 'endPhase' }
  | { type: 'answerPrompt'; answer: PromptAnswer };

export type ApplyResult = { ok: true } | { ok: false; reason: string };

/** Public log line. The UI renders `text` followed by the card names. */
export interface LogEntry {
  player: number | null;
  text: string;
  cards?: CardId[];
}

export interface PlayerScore {
  playerId: string;
  name: string;
  vp: number;
  turns: number;
  breakdown: Record<CardId, { count: number; vp: number }>;
}

export interface GameResult {
  scores: PlayerScore[];
  winners: string[];
}

export interface GameState {
  players: PlayerState[];
  supply: Record<CardId, number>;
  kingdom: CardId[];
  trash: CardId[];
  turn: TurnState;
  pending: Prompt | null;
  log: LogEntry[];
  rng: RngState;
  result: GameResult | null;
}
