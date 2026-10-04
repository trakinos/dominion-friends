// Helpers for tests only. Not imported by production code.
import { createGame, freshTurn } from './setup';
import type { CardId, GameState, Intent, PlayerState } from './types';

export const TEST_KINGDOM: CardId[] = [
  'cellar', 'chapel', 'moat', 'village', 'workshop', 'militia', 'smithy', 'festival', 'laboratory', 'market',
];

/** A fresh game where player 0 is to move and the log is empty. Player ids are p0, p1, ... */
export function newState(opts: { players?: number; kingdom?: CardId[]; seed?: number } = {}): GameState {
  const n = opts.players ?? 2;
  const state = createGame({
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
    kingdom: opts.kingdom ?? TEST_KINGDOM,
    seed: opts.seed ?? 1,
  });
  state.turn = freshTurn(0);
  state.log = [];
  return state;
}

type Zones = Partial<Pick<PlayerState, 'deck' | 'hand' | 'discard' | 'inPlay'>>;

export function setZones(state: GameState, player: number, zones: Zones): void {
  Object.assign(state.players[player], structuredClone(zones));
}

export const answerCards = (indices: number[]): Intent => ({ type: 'answerPrompt', answer: { kind: 'cards', indices } });
export const answerSupply = (card: CardId | null): Intent => ({ type: 'answerPrompt', answer: { kind: 'supply', card } });
export const answerOption = (index: number): Intent => ({ type: 'answerPrompt', answer: { kind: 'option', index } });
export const answerOrder = (order: number[]): Intent => ({ type: 'answerPrompt', answer: { kind: 'order', order } });
