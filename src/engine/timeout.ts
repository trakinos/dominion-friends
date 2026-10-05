import type { Game } from './game';
import { randomAnswer } from './randomAnswer';
import type { RngState } from './rng';
import type { Prompt, PromptAnswer } from './types';

/** Safety net: a turn never needs anywhere near this many forced moves. */
const MAX_FORCED_MOVES = 500;

/** Prompts whose answer can play another card. A timeout always declines them. */
const PLAYS_A_CARD: ReadonlySet<string> = new Set(['throneRoomChoose', 'vassalPlay']);

/** The answer a timed-out player gives: decline anything that would play a card, otherwise random. */
export function timeoutAnswer(prompt: Prompt, rng: RngState): PromptAnswer {
  if (PLAYS_A_CARD.has(prompt.id)) {
    if (prompt.kind === 'chooseCards' && prompt.min === 0) return { kind: 'cards', indices: [] };
    if (prompt.kind === 'chooseOption') {
      const leave = prompt.optionIds.indexOf('leaveIt');
      if (leave >= 0) return { kind: 'option', index: leave };
    }
  }
  return randomAnswer(prompt, rng);
}

/** Answers the pending prompt as a timed-out player (see timeoutAnswer), as the player who owns it. */
export function answerAtRandom(game: Game, rng: RngState): boolean {
  const p = game.state.pending;
  if (!p) return false;
  const owner = game.state.players[p.player].id;
  return game.apply(owner, { type: 'answerPrompt', answer: timeoutAnswer(p, rng) }).ok;
}

/** Ends the current turn: timeout answers for open prompts, then End Phase until the next player is up. Never plays or buys. */
export function finishTurn(game: Game, rng: RngState): void {
  const s = game.state;
  const turn = s.turn;
  for (let i = 0; i < MAX_FORCED_MOVES && !s.result && s.turn === turn; i++) {
    if (s.pending) answerAtRandom(game, rng);
    else game.apply(s.players[turn.player].id, { type: 'endPhase' });
  }
}
