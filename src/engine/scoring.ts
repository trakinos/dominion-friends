import { cardVp, getCard } from '../cards/registry';
import type { CardId, GameResult, GameState, PlayerScore, PlayerState } from './types';
import { emptyPileCount, ownedCards } from './zones';

export function scorePlayer(p: PlayerState): PlayerScore {
  const owned = ownedCards(p);
  const breakdown: Record<CardId, { count: number; vp: number }> = {};
  let vp = 0;
  for (const id of owned) {
    if (getCard(id).vp === undefined) continue;
    const value = cardVp(id, owned);
    const row = breakdown[id] ?? (breakdown[id] = { count: 0, vp: 0 });
    row.count++;
    row.vp += value;
    vp += value;
  }
  return { playerId: p.id, name: p.name, vp, turns: p.turnsTaken, breakdown };
}

export function isGameOver(state: GameState): boolean {
  return state.supply.province === 0 || emptyPileCount(state) >= 3;
}

export function computeResult(state: GameState): GameResult {
  const scores = state.players.map(scorePlayer);
  const best = Math.max(...scores.map((s) => s.vp));
  const tied = scores.filter((s) => s.vp === best);
  const fewest = Math.min(...tied.map((s) => s.turns));
  return { scores, winners: tied.filter((s) => s.turns === fewest).map((s) => s.playerId) };
}
