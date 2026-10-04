import type { CardId } from '../../engine/types';
import type { Effect } from '../types';

export const HAND_EFFECTS: Record<CardId, Effect> = {
  *cellar(ctx) {
    ctx.addActions(1);
    const hand = ctx.state.players[ctx.me].hand;
    const picked = yield* ctx.chooseFromHand(ctx.me, {
      id: 'cellarDiscard', min: 0, max: hand.length, message: 'Discard any number of cards, then draw that many',
    });
    ctx.discardFromHand(ctx.me, picked);
    ctx.draw(ctx.me, picked.length);
  },
  *moat(ctx) {
    ctx.draw(ctx.me, 2);
  },
  *merchant(ctx) {
    ctx.draw(ctx.me, 1);
    ctx.addActions(1);
    ctx.state.turn.merchants++;
  },
  *council_room(ctx) {
    ctx.draw(ctx.me, 4);
    ctx.addBuys(1);
    for (const opp of ctx.opponents()) ctx.draw(opp, 1);
  },
  *moneylender(ctx) {
    const picked = yield* ctx.chooseFromHand(ctx.me, {
      id: 'trashCopper', min: 0, max: 1, message: 'You may trash a Copper for +$3', filter: (c) => c === 'copper',
    });
    if (picked.length === 0) return;
    ctx.trashFromHand(ctx.me, picked);
    ctx.addCoins(3);
  },
  *poacher(ctx) {
    ctx.draw(ctx.me, 1);
    ctx.addActions(1);
    ctx.addCoins(1);
    const n = Math.min(ctx.emptySupplyPiles(), ctx.state.players[ctx.me].hand.length);
    const picked = yield* ctx.chooseFromHand(ctx.me, { id: 'discardForEmptyPiles', params: { n }, min: n, max: n, message: `Discard ${n} card(s)` });
    ctx.discardFromHand(ctx.me, picked);
  },
  *workshop(ctx) {
    const card = yield* ctx.chooseSupply(ctx.me, { id: 'gainUpTo', params: { cost: 4 }, maxCost: 4, message: 'Gain a card costing up to $4' });
    if (card) ctx.gain(ctx.me, card);
  },
  *harbinger(ctx) {
    ctx.draw(ctx.me, 1);
    ctx.addActions(1);
    const discard = ctx.state.players[ctx.me].discard;
    const picked = yield* ctx.chooseCards(ctx.me, discard, {
      id: 'harbingerTopdeck', min: 0, max: 1, message: 'You may put a card from your discard pile onto your deck',
    });
    if (picked.length === 0) return;
    const [card] = discard.splice(picked[0], 1);
    ctx.putOnDeck(ctx.me, [card]);
    ctx.log(ctx.me, 'puts a card from their discard pile onto their deck');
  },
  *vassal(ctx) {
    ctx.addCoins(2);
    const [card] = ctx.takeFromDeck(ctx.me, 1);
    if (card === undefined) return;
    ctx.discardCards(ctx.me, [card]);
    if (!ctx.isType(card, 'action')) return;
    const choice = yield* ctx.chooseOption(ctx.me, {
      id: 'vassalPlay', message: 'Play the discarded Action card?',
      options: ['Play it', 'Leave it'], optionIds: ['playIt', 'leaveIt'], cards: [card],
    });
    if (choice !== 0) return;
    const me = ctx.state.players[ctx.me];
    me.discard.splice(me.discard.lastIndexOf(card), 1);
    me.inPlay.push(card);
    ctx.log(ctx.me, 'plays', [card]);
    yield* ctx.playCard(card);
  },
};
