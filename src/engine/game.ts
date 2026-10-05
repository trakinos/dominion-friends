import { getCard, isType } from '../cards/registry';
import type { Gen } from '../cards/types';
import { createContext } from './context';
import { validateAnswer } from './prompts';
import { computeResult, isGameOver } from './scoring';
import { createGame, freshTurn, type SetupOptions } from './setup';
import type { ApplyResult, CardId, GameState, Intent, PlayerState, PromptAnswer } from './types';
import { drawCards } from './zones';

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

export class Game {
  readonly state: GameState;
  /** The card effect paused on a prompt. Lives only in host memory. */
  private effect: Gen | null = null;

  constructor(state: GameState) {
    this.state = state;
  }

  static create(opts: SetupOptions): Game {
    return new Game(createGame(opts));
  }

  apply(playerId: string, intent: Intent): ApplyResult {
    const s = this.state;
    if (s.result) return fail('The game is over');
    const player = s.players.findIndex((p) => p.id === playerId);
    if (player < 0) return fail('Unknown player');
    if (!intent || typeof intent !== 'object') return fail('Invalid intent');

    if (s.pending) {
      if (intent.type !== 'answerPrompt') return fail('Waiting for a choice to be made');
      if (s.pending.player !== player) return fail('It is not your choice to make');
      if (!this.effect) return fail('This choice can no longer be resumed');
      const err = validateAnswer(s.pending, intent.answer);
      if (err) return fail(err);
      this.resume(intent.answer);
      return ok();
    }
    if (intent.type === 'answerPrompt') return fail('Nothing to answer');
    if (player !== s.turn.player) return fail('It is not your turn');

    switch (intent.type) {
      case 'playAction': return this.playAction(intent.handIndex);
      case 'playTreasure': return this.playTreasure(intent.handIndex);
      case 'playAllTreasures': return this.playAllTreasures();
      case 'buy': return this.buy(intent.card);
      case 'endPhase': return this.endPhase();
      default: return fail('Unknown intent');
    }
  }

  private get current(): PlayerState {
    return this.state.players[this.state.turn.player];
  }

  private log(player: number | null, text: string, cards?: CardId[]): void {
    this.state.log.push(cards ? { player, text, cards: [...cards] } : { player, text });
  }

  /** A log line from outside the rules, such as the host's timer. */
  note(player: number | null, text: string): void {
    this.log(player, text);
  }

  private validHandIndex(i: number): boolean {
    return Number.isInteger(i) && i >= 0 && i < this.current.hand.length;
  }

  private playAction(i: number): ApplyResult {
    const { turn } = this.state;
    if (turn.phase !== 'action') return fail('You can only play Actions in your Action phase');
    if (!this.validHandIndex(i)) return fail('No such card in hand');
    const card = this.current.hand[i];
    if (!isType(card, 'action')) return fail('That is not an Action card');
    if (turn.actions < 1) return fail('No Actions left');

    turn.actions--;
    this.current.hand.splice(i, 1);
    this.current.inPlay.push(card);
    this.log(turn.player, 'plays', [card]);
    this.effect = createContext(this.state, turn.player).playCard(card);
    this.resume(undefined);
    return ok();
  }

  /** Runs the paused effect until it needs another answer or finishes. */
  private resume(answer: PromptAnswer | undefined): void {
    const effect = this.effect;
    if (!effect) return;
    const step = answer === undefined ? effect.next() : effect.next(answer);
    if (step.done) {
      this.effect = null;
      this.state.pending = null;
    } else {
      this.state.pending = step.value;
    }
  }

  private playTreasure(i: number): ApplyResult {
    if (this.state.turn.boughtThisTurn) return fail('You cannot play Treasures after buying');
    if (!this.validHandIndex(i)) return fail('No such card in hand');
    const card = this.current.hand[i];
    if (!isType(card, 'treasure')) return fail('That is not a Treasure');
    this.playTreasureAt(i);
    this.log(this.state.turn.player, 'plays', [card]);
    return ok();
  }

  private playAllTreasures(): ApplyResult {
    if (this.state.turn.boughtThisTurn) return fail('You cannot play Treasures after buying');
    const treasures = this.current.hand.filter((c) => isType(c, 'treasure'));
    if (treasures.length === 0) return fail('No Treasures to play');
    for (const card of treasures) this.playTreasureAt(this.current.hand.indexOf(card));
    this.log(this.state.turn.player, 'plays', treasures);
    return ok();
  }

  private playTreasureAt(i: number): void {
    const { turn } = this.state;
    const [card] = this.current.hand.splice(i, 1);
    this.current.inPlay.push(card);
    turn.phase = 'buy';
    turn.coins += getCard(card).coins ?? 0;
    if (card === 'silver' && !turn.silverPlayed) {
      turn.silverPlayed = true;
      turn.coins += turn.merchants;
    }
  }

  private buy(card: CardId): ApplyResult {
    const { turn, supply } = this.state;
    if (typeof card !== 'string' || !Object.hasOwn(supply, card)) return fail('No such pile');
    if (supply[card] <= 0) return fail('That pile is empty');
    if (turn.buys < 1) return fail('No Buys left');
    const cost = getCard(card).cost;
    if (cost > turn.coins) return fail('Not enough coins');

    turn.phase = 'buy';
    turn.coins -= cost;
    turn.buys--;
    turn.boughtThisTurn = true;
    supply[card]--;
    this.current.discard.push(card);
    this.log(turn.player, 'buys', [card]);
    return ok();
  }

  private endPhase(): ApplyResult {
    if (this.state.turn.phase === 'action') {
      this.state.turn.phase = 'buy';
      return ok();
    }
    this.cleanup();
    return ok();
  }

  private cleanup(): void {
    const s = this.state;
    const p = this.current;
    p.discard.push(...p.hand, ...p.inPlay);
    p.hand = [];
    p.inPlay = [];
    drawCards(s, s.turn.player, 5);
    p.turnsTaken++;
    if (isGameOver(s)) {
      s.result = computeResult(s);
      this.log(null, 'Game over');
      return;
    }
    s.turn = freshTurn((s.turn.player + 1) % s.players.length);
  }
}
