import type { CardId } from '../../engine/types';
import type { Effect } from '../types';

export const LOOK_EFFECTS: Record<CardId, Effect> = {
  *library(ctx) {
    const setAside: CardId[] = [];
    while (ctx.state.players[ctx.me].hand.length < 7) {
      const [card] = ctx.takeFromDeck(ctx.me, 1);
      if (card === undefined) break;
      if (ctx.isType(card, 'action')) {
        const choice = yield* ctx.chooseOption(ctx.me, 'You drew an Action card. Set it aside?', ['Set it aside', 'Keep it'], [card]);
        if (choice === 0) {
          setAside.push(card);
          continue;
        }
      }
      ctx.state.players[ctx.me].hand.push(card);
    }
    ctx.discardCards(ctx.me, setAside);
  },
  *sentry(ctx) {
    ctx.draw(ctx.me, 1);
    ctx.addActions(1);
    const looked = ctx.takeFromDeck(ctx.me, 2);
    const kept: CardId[] = [];
    for (const card of looked) {
      const choice = yield* ctx.chooseOption(ctx.me, 'What do you do with this card?', ['Trash', 'Discard', 'Put back'], [card]);
      if (choice === 0) ctx.trashCards(ctx.me, [card]);
      else if (choice === 1) ctx.discardCards(ctx.me, [card]);
      else kept.push(card);
    }
    const ordered = yield* ctx.orderCards(ctx.me, kept, 'Order the cards to put back (first = top of deck)');
    ctx.putOnDeck(ctx.me, ordered);
  },
};
