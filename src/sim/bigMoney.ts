import { getCard, isType } from '../cards/registry';
import type { Game } from '../engine/game';
import type { CardId, Intent, Prompt, PromptAnswer } from '../engine/types';

/** The simplest legal answer to any prompt. */
export function defaultAnswer(prompt: Prompt): PromptAnswer {
  switch (prompt.kind) {
    case 'chooseCards':
      return { kind: 'cards', indices: prompt.selectable.slice(0, prompt.min) };
    case 'chooseSupply': {
      if (prompt.optional) return { kind: 'supply', card: null };
      const best = [...prompt.piles].sort((a, b) => getCard(b).cost - getCard(a).cost)[0];
      return { kind: 'supply', card: best };
    }
    case 'chooseOption':
      return { kind: 'option', index: 0 };
    case 'orderCards':
      return { kind: 'order', order: prompt.cards.map((_, i) => i) };
  }
}

/** Big Money: play any Action, play all Treasures, buy Province/Gold/Silver. */
export function botMove(game: Game): { playerId: string; intent: Intent } {
  const s = game.state;
  if (s.pending) {
    return {
      playerId: s.players[s.pending.player].id,
      intent: { type: 'answerPrompt', answer: defaultAnswer(s.pending) },
    };
  }
  const p = s.players[s.turn.player];
  const t = s.turn;
  const move = (intent: Intent) => ({ playerId: p.id, intent });

  if (t.phase === 'action' && t.actions > 0) {
    const i = p.hand.findIndex((c) => isType(c, 'action'));
    if (i >= 0) return move({ type: 'playAction', handIndex: i });
  }
  if (!t.boughtThisTurn && p.hand.some((c) => isType(c, 'treasure'))) {
    return move({ type: 'playAllTreasures' });
  }
  if (t.buys > 0) {
    const want: CardId | null = t.coins >= 8 ? 'province' : t.coins >= 6 ? 'gold' : t.coins >= 3 ? 'silver' : null;
    if (want && s.supply[want] > 0) return move({ type: 'buy', card: want });
  }
  return move({ type: 'endPhase' });
}
