import { ownedCards } from '../engine/zones';
import { getCard, isType } from '../cards/registry';
import type { Game } from '../engine/game';
import type { CardId, Intent, Prompt, PromptAnswer } from '../engine/types';

/** The simplest legal answer to any prompt. */
export function defaultAnswer(prompt: Prompt): PromptAnswer {
  switch (prompt.kind) {
    case 'chooseCards': {
      if (prompt.min === 0 && prompt.max > 1) {
        // Multi-card optional choices (Chapel, Cellar): only get rid of dead cards,
        // otherwise a Chapel-happy bot trashes its whole deck and the game never ends.
        const dead = prompt.selectable.find((i) => ['curse', 'estate'].includes(prompt.cards[i]));
        return { kind: 'cards', indices: dead === undefined ? [] : [dead] };
      }
      return {
        kind: 'cards',
        indices: prompt.selectable.slice(0, Math.max(prompt.min, Math.min(1, prompt.max))),
      };
    }
    case 'chooseSupply': {
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
    const coins = t.coins;
    let want: CardId | null = null;
    if (coins >= 8) want = 'province';
    else if (coins >= 6) want = 'gold';
    else {
      const kingdomOwned = ownedCards(p).filter((c) => s.kingdom.includes(c)).length;
      if (kingdomOwned < 4) {
        let best: CardId | null = null;
        for (const c of s.kingdom) {
          if (s.supply[c] > 0 && getCard(c).cost <= coins && (!best || getCard(c).cost > getCard(best).cost)) best = c;
        }
        want = best;
      }
      if (!want && coins >= 3) want = 'silver';
    }
    if (want && s.supply[want] > 0) return move({ type: 'buy', card: want });
  }
  return move({ type: 'endPhase' });
}
