import type { CardId } from '../../engine/types';
import type { Effect } from '../types';

export const TRANSFORM_EFFECTS: Record<CardId, Effect> = {
  *remodel(ctx) {
    const picked = yield* ctx.chooseFromHand(ctx.me, { min: 1, max: 1, message: 'Trash a card from your hand' });
    if (picked.length === 0) return;
    const [trashed] = ctx.trashFromHand(ctx.me, picked);
    const maxCost = ctx.cost(trashed) + 2;
    const card = yield* ctx.chooseSupply(ctx.me, { maxCost, message: `Gain a card costing up to $${maxCost}` });
    if (card) ctx.gain(ctx.me, card);
  },
  *mine(ctx) {
    const picked = yield* ctx.chooseFromHand(ctx.me, {
      min: 0, max: 1, message: 'You may trash a Treasure from your hand', filter: (c) => ctx.isType(c, 'treasure'),
    });
    if (picked.length === 0) return;
    const [trashed] = ctx.trashFromHand(ctx.me, picked);
    const maxCost = ctx.cost(trashed) + 3;
    const card = yield* ctx.chooseSupply(ctx.me, {
      maxCost, type: 'treasure', message: `Gain a Treasure to your hand costing up to $${maxCost}`,
    });
    if (card) ctx.gain(ctx.me, card, 'hand');
  },
  *artisan(ctx) {
    const card = yield* ctx.chooseSupply(ctx.me, { maxCost: 5, message: 'Gain a card to your hand costing up to $5' });
    if (card) ctx.gain(ctx.me, card, 'hand');
    const picked = yield* ctx.chooseFromHand(ctx.me, { min: 1, max: 1, message: 'Put a card from your hand onto your deck' });
    if (picked.length > 0) ctx.topdeckFromHand(ctx.me, picked[0]);
  },
  *throne_room(ctx) {
    const picked = yield* ctx.chooseFromHand(ctx.me, {
      min: 0, max: 1, message: 'You may play an Action card from your hand twice', filter: (c) => ctx.isType(c, 'action'),
    });
    if (picked.length === 0) return;
    const me = ctx.state.players[ctx.me];
    const [card] = me.hand.splice(picked[0], 1);
    me.inPlay.push(card);
    ctx.log(ctx.me, 'plays', [card]);
    yield* ctx.playCard(card);
    yield* ctx.playCard(card);
  },
};
