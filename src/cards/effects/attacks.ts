import type { CardId } from '../../engine/types';
import type { Effect } from '../types';

export const ATTACK_EFFECTS: Record<CardId, Effect> = {
  *militia(ctx) {
    ctx.addCoins(2);
    const victims = yield* ctx.attackedOpponents();
    for (const opp of victims) {
      const n = ctx.state.players[opp].hand.length - 3;
      if (n <= 0) continue;
      const picked = yield* ctx.chooseFromHand(opp, { min: n, max: n, message: `Discard ${n} card(s), down to 3` });
      ctx.discardFromHand(opp, picked);
    }
  },
  *witch(ctx) {
    ctx.draw(ctx.me, 2);
    const victims = yield* ctx.attackedOpponents();
    for (const opp of victims) ctx.gain(opp, 'curse');
  },
  *bandit(ctx) {
    ctx.gain(ctx.me, 'gold');
    const victims = yield* ctx.attackedOpponents();
    for (const opp of victims) {
      const revealed = ctx.takeFromDeck(opp, 2);
      if (revealed.length === 0) continue;
      ctx.log(opp, 'reveals', revealed);
      const targets = revealed
        .map((_, i) => i)
        .filter((i) => ctx.isType(revealed[i], 'treasure') && revealed[i] !== 'copper');
      const picked = yield* ctx.chooseCards(opp, revealed, {
        min: 1, max: 1, selectable: targets, message: 'Trash a revealed Treasure',
      });
      ctx.trashCards(opp, picked.map((i) => revealed[i]));
      ctx.discardCards(opp, revealed.filter((_, i) => !picked.includes(i)));
    }
  },
  *bureaucrat(ctx) {
    ctx.gain(ctx.me, 'silver', 'deck');
    const victims = yield* ctx.attackedOpponents();
    for (const opp of victims) {
      const hand = ctx.state.players[opp].hand;
      const picked = yield* ctx.chooseFromHand(opp, {
        min: 1, max: 1, message: 'Put a Victory card from your hand onto your deck', filter: (c) => ctx.isType(c, 'victory'),
      });
      if (picked.length === 0) {
        ctx.log(opp, 'reveals a hand with no Victory cards', hand);
        continue;
      }
      ctx.log(opp, 'reveals', [hand[picked[0]]]);
      ctx.topdeckFromHand(opp, picked[0]);
    }
  },
};
