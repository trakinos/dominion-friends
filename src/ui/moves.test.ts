import { describe, it, expect } from 'vitest';
import { Game } from '../engine/game';
import { newState, setZones } from '../engine/testkit';
import { viewFor } from '../engine/view';
import { buyablePiles, canPlayAllTreasures, intentForHandCard, isMyTurn, playableHand, sortByCost, supplyGroups } from './moves';

function stateWithHand(hand: string[]) {
  const state = newState();
  setZones(state, 0, { hand, deck: ['estate', 'estate', 'estate'], discard: [] });
  return state;
}

describe('moves', () => {
  it('knows whose turn it is', () => {
    const state = newState();
    expect(isMyTurn(viewFor(state, 'p0'))).toBe(true);
    expect(isMyTurn(viewFor(state, 'p1'))).toBe(false);
  });

  it('marks Actions and Treasures playable on your turn', () => {
    const state = stateWithHand(['village', 'copper', 'estate']);
    expect(playableHand(viewFor(state, 'p0'))).toEqual([true, true, false]);
    expect(canPlayAllTreasures(viewFor(state, 'p0'))).toBe(true);
  });

  it('marks nothing playable on someone else\'s turn', () => {
    const state = stateWithHand(['village', 'copper']);
    setZones(state, 1, { hand: ['village', 'copper'] });
    expect(playableHand(viewFor(state, 'p1'))).toEqual([false, false]);
    expect(canPlayAllTreasures(viewFor(state, 'p1'))).toBe(false);
  });

  it('stops Actions with no Actions left and Treasures after buying', () => {
    const state = stateWithHand(['village', 'copper']);
    state.turn.actions = 0;
    expect(playableHand(viewFor(state, 'p0'))).toEqual([false, true]);
    state.turn.boughtThisTurn = true;
    expect(playableHand(viewFor(state, 'p0'))).toEqual([false, false]);
    expect(canPlayAllTreasures(viewFor(state, 'p0'))).toBe(false);
  });

  it('marks nothing playable while a prompt is open', () => {
    const game = new Game(stateWithHand(['chapel', 'copper', 'estate']));
    game.apply('p0', { type: 'playAction', handIndex: 0 });
    const view = viewFor(game.state, 'p0');
    expect(view.prompt).not.toBeNull();
    expect(playableHand(view)).toEqual([false, false]);
    expect(buyablePiles(view).size).toBe(0);
  });

  it('lists affordable, non-empty piles while you have Buys', () => {
    const state = newState();
    state.turn.coins = 3;
    state.supply.village = 0;
    const piles = buyablePiles(viewFor(state, 'p0'));
    expect(piles.has('silver')).toBe(true);
    expect(piles.has('cellar')).toBe(true);
    expect(piles.has('village')).toBe(false);
    expect(piles.has('gold')).toBe(false);
    state.turn.buys = 0;
    expect(buyablePiles(viewFor(state, 'p0')).size).toBe(0);
  });

  it('turns a hand click into the right intent', () => {
    const view = viewFor(stateWithHand(['village', 'copper', 'estate']), 'p0');
    expect(intentForHandCard(view, 0)).toEqual({ type: 'playAction', handIndex: 0 });
    expect(intentForHandCard(view, 1)).toEqual({ type: 'playTreasure', handIndex: 1 });
    expect(intentForHandCard(view, 2)).toBeNull();
    expect(intentForHandCard(view, 9)).toBeNull();
  });

  it('orders the supply by cost, then name', () => {
    expect(sortByCost(['market', 'village', 'cellar', 'festival'])).toEqual(['cellar', 'village', 'festival', 'market']);
    const groups = supplyGroups(viewFor(newState(), 'p0'));
    expect(groups.treasure).toEqual(['copper', 'silver', 'gold']);
    expect(groups.victory).toEqual(['estate', 'duchy', 'province', 'curse']);
    expect(groups.kingdom).toHaveLength(10);
  });
});
