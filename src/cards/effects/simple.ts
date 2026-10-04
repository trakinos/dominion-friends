import type { CardId } from '../../engine/types';
import type { Effect } from '../types';

export const SIMPLE_EFFECTS: Record<CardId, Effect> = {
  *village(ctx) {
    ctx.draw(ctx.me, 1);
    ctx.addActions(2);
  },
  *smithy(ctx) {
    ctx.draw(ctx.me, 3);
  },
  *laboratory(ctx) {
    ctx.draw(ctx.me, 2);
    ctx.addActions(1);
  },
  *festival(ctx) {
    ctx.addActions(2);
    ctx.addBuys(1);
    ctx.addCoins(2);
  },
  *market(ctx) {
    ctx.draw(ctx.me, 1);
    ctx.addActions(1);
    ctx.addBuys(1);
    ctx.addCoins(1);
  },
  *chapel(ctx) {
    const picked = yield* ctx.chooseFromHand(ctx.me, { id: 'trashUpTo4', min: 0, max: 4, message: 'Trash up to 4 cards from your hand' });
    ctx.trashFromHand(ctx.me, picked);
  },
};
