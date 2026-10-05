import type { Game } from './game';
import { randomAnswer } from './randomAnswer';
import type { RngState } from './rng';

/** Safety net: a turn never needs anywhere near this many forced moves. */
const MAX_FORCED_MOVES = 500;

/** Answers the pending prompt at random, as the player who owns it. */
export function answerAtRandom(game: Game, rng: RngState): boolean {
  const p = game.state.pending;
  if (!p) return false;
  const owner = game.state.players[p.player].id;
  return game.apply(owner, { type: 'answerPrompt', answer: randomAnswer(p, rng) }).ok;
}

/** Ends the current turn: random answers for open prompts, then End Phase until the next player is up. Never plays or buys. */
export function finishTurn(game: Game, rng: RngState): void {
  const s = game.state;
  const turn = s.turn;
  for (let i = 0; i < MAX_FORCED_MOVES && !s.result && s.turn === turn; i++) {
    if (s.pending) answerAtRandom(game, rng);
    else game.apply(s.players[turn.player].id, { type: 'endPhase' });
  }
}
