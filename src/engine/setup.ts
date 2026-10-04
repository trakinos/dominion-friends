import { isType, KINGDOM_IDS } from '../cards/registry';
import { createRng, nextInt, shuffle } from './rng';
import type { CardId, GameState, PlayerState, TurnState } from './types';
import { drawCards } from './zones';

export interface SetupOptions {
  players: { id: string; name: string }[];
  kingdom: CardId[];
  seed: number;
}

export function freshTurn(player: number): TurnState {
  return {
    player,
    phase: 'action',
    actions: 1,
    buys: 1,
    coins: 0,
    boughtThisTurn: false,
    merchants: 0,
    silverPlayed: false,
  };
}

export function createGame(opts: SetupOptions): GameState {
  const n = opts.players.length;
  if (n < 2 || n > 4) throw new Error('Need 2-4 players');
  if (new Set(opts.players.map((p) => p.id)).size !== n) throw new Error('Player ids must be unique');
  const kingdom = [...new Set(opts.kingdom)];
  if (opts.kingdom.length !== 10 || kingdom.length !== 10) throw new Error('Kingdom must have 10 different cards');
  for (const id of kingdom) {
    if (!KINGDOM_IDS.includes(id)) throw new Error(`Not a kingdom card: ${id}`);
  }

  const rng = createRng(opts.seed);
  const victoryCount = n === 2 ? 8 : 12;
  const supply: Record<CardId, number> = {
    copper: 60 - 7 * n,
    silver: 40,
    gold: 30,
    estate: victoryCount,
    duchy: victoryCount,
    province: victoryCount,
    curse: 10 * (n - 1),
  };
  for (const id of kingdom) supply[id] = isType(id, 'victory') ? victoryCount : 10;

  const starting: CardId[] = [...Array(7).fill('copper'), ...Array(3).fill('estate')];
  const players: PlayerState[] = opts.players.map((p) => ({
    id: p.id,
    name: p.name,
    deck: shuffle(rng, starting),
    hand: [],
    discard: [],
    inPlay: [],
    turnsTaken: 0,
  }));

  const state: GameState = {
    players,
    supply,
    kingdom,
    trash: [],
    turn: freshTurn(nextInt(rng, n)),
    pending: null,
    log: [],
    rng,
    result: null,
  };
  for (let i = 0; i < n; i++) drawCards(state, i, 5);
  state.log.push({ player: state.turn.player, text: 'takes the first turn' });
  return state;
}
