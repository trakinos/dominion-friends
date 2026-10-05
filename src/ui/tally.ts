import type { CardId, GameResult } from '../engine/types';

export interface TallyStep {
  /** Index into `result.scores`. */
  player: number;
  card: CardId;
  points: number;
  total: number;
}

/** Target length of the whole count, in ms. */
const TALLY_MS = 7000;
const MIN_STEP_MS = 90;
const MAX_STEP_MS = 650;

/**
 * The order the end screen counts VP cards in: one card per player per round,
 * each player's cards from most to fewest points, so Curses come last. Gardens
 * counts at its worked-out per-card value. Pure, so every browser shows the same count.
 */
export function tallySteps(result: GameResult): TallyStep[] {
  const queues = result.scores.map((s) =>
    Object.entries(s.breakdown)
      .flatMap(([card, row]) => Array.from({ length: row.count }, () => ({ card: card as CardId, points: row.vp / row.count })))
      .sort((a, b) => b.points - a.points),
  );
  const totals = result.scores.map(() => 0);
  const steps: TallyStep[] = [];
  for (let round = 0; queues.some((q) => round < q.length); round++) {
    queues.forEach((q, player) => {
      const next = q[round];
      if (!next) return;
      totals[player] += next.points;
      steps.push({ player, card: next.card, points: next.points, total: totals[player] });
    });
  }
  return steps;
}

/** A little slower at the start, faster at the end, about TALLY_MS in all. */
export function stepDelay(index: number, count: number): number {
  const progress = count <= 1 ? 0 : index / (count - 1);
  const base = TALLY_MS / Math.max(1, count);
  return Math.round(Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, base * (1.4 - 0.8 * progress))));
}
