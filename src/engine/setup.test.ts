import { describe, it, expect } from 'vitest';
import { createGame } from './setup';
import { TEST_KINGDOM } from './testkit';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

describe('createGame', () => {
  it('builds the 2-player supply', () => {
    const s = createGame({ players: players(2), kingdom: TEST_KINGDOM, seed: 1 });
    expect(s.supply).toMatchObject({
      copper: 46, silver: 40, gold: 30, estate: 8, duchy: 8, province: 8, curse: 10, village: 10, smithy: 10,
    });
    expect(Object.keys(s.supply)).toHaveLength(17);
  });

  it('builds the 4-player supply', () => {
    const s = createGame({ players: players(4), kingdom: TEST_KINGDOM, seed: 1 });
    expect(s.supply).toMatchObject({ copper: 32, estate: 12, duchy: 12, province: 12, curse: 30 });
  });

  it('uses 8 or 12 cards for Victory kingdom piles', () => {
    const kingdom = [...TEST_KINGDOM.slice(0, 9), 'gardens'];
    expect(createGame({ players: players(2), kingdom, seed: 1 }).supply.gardens).toBe(8);
    expect(createGame({ players: players(3), kingdom, seed: 1 }).supply.gardens).toBe(12);
  });

  it('deals 7 Copper and 3 Estate with 5 cards in hand', () => {
    const s = createGame({ players: players(3), kingdom: TEST_KINGDOM, seed: 5 });
    for (const p of s.players) {
      expect(p.hand).toHaveLength(5);
      expect(p.deck).toHaveLength(5);
      const all = [...p.hand, ...p.deck];
      expect(all.filter((c) => c === 'copper')).toHaveLength(7);
      expect(all.filter((c) => c === 'estate')).toHaveLength(3);
    }
    expect(s.turn).toMatchObject({ phase: 'action', actions: 1, buys: 1, coins: 0 });
    expect(s.turn.player).toBeGreaterThanOrEqual(0);
    expect(s.turn.player).toBeLessThan(3);
  });

  it('is deterministic for a seed', () => {
    const a = createGame({ players: players(2), kingdom: TEST_KINGDOM, seed: 7 });
    const b = createGame({ players: players(2), kingdom: TEST_KINGDOM, seed: 7 });
    expect(a).toEqual(b);
  });

  it('rejects bad options', () => {
    expect(() => createGame({ players: players(1), kingdom: TEST_KINGDOM, seed: 1 })).toThrow('Need 2-4 players');
    expect(() => createGame({ players: players(5), kingdom: TEST_KINGDOM, seed: 1 })).toThrow('Need 2-4 players');
    expect(() => createGame({ players: players(2), kingdom: TEST_KINGDOM.slice(0, 9), seed: 1 })).toThrow('Kingdom must have 10 different cards');
    expect(() => createGame({ players: players(2), kingdom: [...TEST_KINGDOM.slice(0, 9), 'cellar'], seed: 1 })).toThrow('Kingdom must have 10 different cards');
    expect(() => createGame({ players: players(2), kingdom: [...TEST_KINGDOM.slice(0, 9), 'copper'], seed: 1 })).toThrow('Not a kingdom card: copper');
  });

  it('rejects duplicate player ids', () => {
    expect(() => createGame({ players: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }], kingdom: TEST_KINGDOM, seed: 1 })).toThrow('Player ids must be unique');
  });
});
